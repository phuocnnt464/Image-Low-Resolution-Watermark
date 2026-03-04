const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png');

const WATERMARK_RATIO = 0.15;
const PADDING         = 15;

/**
 * Bảng preset: targetWidth là chiều rộng để downsample xuống,
 * sau đó upsample ngược lại về kích thước gốc.
 * null = giữ nguyên resolution (chỉ thay đổi quality encode)
 */
const RESOLUTION_PRESETS = {
  'Original': { targetWidth: null, jpegQuality: 92, webpQuality: 92, pngCompression: 1 },
  '4K':       { targetWidth: 3840, jpegQuality: 85, webpQuality: 85, pngCompression: 2 },
  'QHD':      { targetWidth: 2560, jpegQuality: 78, webpQuality: 78, pngCompression: 4 },
  'FHD':      { targetWidth: 1920, jpegQuality: 70, webpQuality: 70, pngCompression: 5 },
  'HD':       { targetWidth: 1280, jpegQuality: 60, webpQuality: 60, pngCompression: 6 },
  'SD':       { targetWidth: 854,  jpegQuality: 48, webpQuality: 48, pngCompression: 7 },
  'LD':       { targetWidth: 480,  jpegQuality: 35, webpQuality: 35, pngCompression: 8 },
  'Tiny':     { targetWidth: 240,  jpegQuality: 20, webpQuality: 20, pngCompression: 9 },
}

const calcPosition = (position, origW, origH, wmW, wmH, padding) => {
  const cx = Math.round((origW - wmW) / 2)
  const cy = Math.round((origH - wmH) / 2)

  const positions = {
    'top-left':      { left: padding,               top: padding },
    'top-center':    { left: cx,                    top: padding },
    'top-right':     { left: origW - wmW - padding, top: padding },
    'center-left':   { left: padding,               top: cy },
    'center':        { left: cx,                    top: cy },
    'center-right':  { left: origW - wmW - padding, top: cy },
    'bottom-left':   { left: padding,               top: origH - wmH - padding },
    'bottom-center': { left: cx,                    top: origH - wmH - padding },
    'bottom-right':  { left: origW - wmW - padding, top: origH - wmH - padding },
  }

  const pos = positions[position] || positions['bottom-left']
  return {
    left: Math.max(0, pos.left),
    top:  Math.max(0, pos.top),
  }
}

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string} resolutionPreset  - 'Original'|'4K'|'QHD'|'FHD'|'HD'|'SD'|'LD'|'Tiny'
 * @param {string} watermarkPath
 * @param {string} watermarkPosition
 */
const processImage = async (
  inputPath,
  outputPath,
  resolutionPreset = 'FHD',
  watermarkPath    = null,
  watermarkPosition = 'bottom-left'
) => {
  const wmPath = watermarkPath || DEFAULT_WATERMARK_PATH;

  const meta   = await sharp(inputPath).metadata();
  const origW  = meta.width;
  const origH  = meta.height;
  const format = meta.format;

  // ── Lấy tham số preset ────────────────────────────────────────────────────
  const preset = RESOLUTION_PRESETS[resolutionPreset] ?? RESOLUTION_PRESETS['FHD'];
  const { targetWidth, jpegQuality, webpQuality, pngCompression } = preset;

  // ── Tính kích thước downsample ─────────────────────────────────────────────
  // Chỉ downsample nếu targetWidth nhỏ hơn kích thước gốc
  let degradedBuffer;

  if (targetWidth !== null && targetWidth < origW) {
    // Tính height tương ứng giữ tỉ lệ
    const ratio  = targetWidth / origW;
    const midW   = Math.max(2, targetWidth);
    const midH   = Math.max(2, Math.round(origH * ratio));

    degradedBuffer = await sharp(inputPath)
      // Bước 1: downsample xuống targetWidth
      .resize(midW, midH, {
        kernel: sharp.kernel.nearest,
        withoutEnlargement: false,
      })
      // Bước 2: upsample về kích thước gốc (tạo pixelation/mất chi tiết)
      .resize(origW, origH, {
        kernel: sharp.kernel.nearest,
        withoutEnlargement: false,
      })
      .toBuffer();
  } else {
    // Original hoặc preset lớn hơn ảnh gốc → không downsample
    degradedBuffer = await sharp(inputPath).toBuffer();
  }

  // ── Watermark ─────────────────────────────────────────────────────────────
  let compositeOptions = [];

  if (fs.existsSync(wmPath)) {
    const wmMeta  = await sharp(wmPath).metadata();
    const wmMaxW  = Math.round(origW * WATERMARK_RATIO);
    const wmScale = Math.min(1, wmMaxW / wmMeta.width);
    const wmW     = Math.max(1, Math.round(wmMeta.width  * wmScale));
    const wmH     = Math.max(1, Math.round(wmMeta.height * wmScale));

    const watermarkBuffer = await sharp(wmPath)
      .resize(wmW, wmH, { kernel: sharp.kernel.lanczos3 })
      .toBuffer();

    const { left, top } = calcPosition(watermarkPosition, origW, origH, wmW, wmH, PADDING);
    compositeOptions = [{ input: watermarkBuffer, left, top }];
  } else {
    console.warn(`Watermark không tìm thấy: ${wmPath}`);
  }

  // ── Encode output ──────────────────────────────────────────────────────────
  let pipeline = sharp(degradedBuffer)
    .composite(compositeOptions)
    .withMetadata({ density: 72 });

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({
        quality: jpegQuality,
        progressive: true,
        mozjpeg: true,
      });
      break;

    case 'png':
      pipeline = pipeline.png({
        compressionLevel: pngCompression,
        // Bật palette (giảm bit depth màu) cho các preset thấp
        palette: pngCompression >= 6,
        colours: pngCompression >= 6
          ? Math.max(32, 256 - (pngCompression - 6) * 56)  // 256→32
          : 256,
      });
      break;

    case 'webp':
      pipeline = pipeline.webp({ quality: webpQuality });
      break;

    default:
      pipeline = pipeline.jpeg({
        quality: jpegQuality,
        progressive: true,
        mozjpeg: true,
      });
  }

  const info = await pipeline.toFile(outputPath);

  console.log(
    `[processImage] preset=${resolutionPreset} | ` +
    `targetWidth=${targetWidth ?? 'original'} (${origW}×${origH}) | ` +
    `jpegQuality=${jpegQuality} | output=${(info.size / 1024).toFixed(1)} KB`
  );

  return {
    originalWidth:   origW,
    originalHeight:  origH,
    processedWidth:  info.width,
    processedHeight: info.height,
    processedSize:   info.size,
  };
};

module.exports = { processImage };