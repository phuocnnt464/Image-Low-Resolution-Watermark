const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png');

const WATERMARK_RATIO = 0.15;
const PADDING         = 15;

/**
 * Bảng preset
 * targetWidth : resize ảnh xuống width này (giữ tỉ lệ), rồi upsample về origW×origH
 *               null = không downsample, chỉ encode lại với quality cao
 * jpegQuality : quality encode JPEG / WebP
 * pngColours  : số màu palette PNG (256 = full, <256 = giảm bit depth màu)
 * pngCompression: mức nén zlib PNG (1–9)
 */
const RESOLUTION_PRESETS = {
  //             targetWidth  jpegQ  webpQ  pngColours  pngComp
  'Original': { targetWidth: null, jpegQuality: 92, webpQuality: 92, pngColours: 256, pngCompression: 1 },
  '4K':       { targetWidth: 3840, jpegQuality: 85, webpQuality: 85, pngColours: 256, pngCompression: 2 },
  'QHD':      { targetWidth: 2560, jpegQuality: 78, webpQuality: 78, pngColours: 256, pngCompression: 4 },
  'FHD':      { targetWidth: 1920, jpegQuality: 70, webpQuality: 70, pngColours: 256, pngCompression: 5 },
  'HD':       { targetWidth: 1280, jpegQuality: 60, webpQuality: 60, pngColours: 128, pngCompression: 6 },
  'SD':       { targetWidth: 854,  jpegQuality: 48, webpQuality: 48, pngColours: 64,  pngCompression: 7 },
  'LD':       { targetWidth: 480,  jpegQuality: 35, webpQuality: 35, pngColours: 32,  pngCompression: 8 },
  'Tiny':     { targetWidth: 240,  jpegQuality: 20, webpQuality: 20, pngColours: 16,  pngCompression: 9 },
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
  return { left: Math.max(0, pos.left), top: Math.max(0, pos.top) }
}

const processImage = async (
  inputPath,
  outputPath,
  resolutionPreset  = 'FHD',
  watermarkPath     = null,
  watermarkPosition = 'bottom-left'
) => {
  const wmPath = watermarkPath || DEFAULT_WATERMARK_PATH;

  const meta   = await sharp(inputPath).metadata();
  const origW  = meta.width;
  const origH  = meta.height;
  const format = meta.format;

  // ── Tham số preset ────────────────────────────────────────────────────────
  const preset = RESOLUTION_PRESETS[resolutionPreset] ?? RESOLUTION_PRESETS['FHD'];
  const { targetWidth, jpegQuality, webpQuality, pngColours, pngCompression } = preset;

  // ── Bước 1: Degradation (resize xuống → upsample về gốc) ─────────────────
  let degradedBuffer;

  if (targetWidth !== null && targetWidth < origW) {
    const ratio = targetWidth / origW;
    const midW  = Math.max(2, targetWidth);
    const midH  = Math.max(2, Math.round(origH * ratio));

    // Downsample xuống targetWidth bằng lanczos3 (mất chi tiết thực sự)
    // rồi upsample về kích thước gốc bằng nearest (tạo pixelation/blocky)
    // Encode trung gian sang JPEG với quality thấp để "khoá" artifact vào buffer
    const downBuf = await sharp(inputPath)
      .resize(midW, midH, { kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: jpegQuality, mozjpeg: true })   // encode lossy tại đây
      .toBuffer();

    // Upsample về kích thước gốc
    degradedBuffer = await sharp(downBuf)
      .resize(origW, origH, { kernel: sharp.kernel.nearest })
      .toBuffer();

  } else {
    // Original hoặc preset lớn hơn ảnh — chỉ đọc thẳng
    degradedBuffer = await sharp(inputPath).toBuffer();
  }

  // ── Bước 2: Watermark ─────────────────────────────────────────────────────
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

  // ── Bước 3: Composite + encode output ────────────────────────────────────
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
        palette: pngColours < 256,
        colours: pngColours,
        dither: pngColours < 128 ? 0.8 : 0,
      });
      break;

    case 'webp':
      pipeline = pipeline.webp({ quality: webpQuality });
      break;

    default:
      pipeline = pipeline.jpeg({ quality: jpegQuality, mozjpeg: true });
  }

  const info = await pipeline.toFile(outputPath);

  console.log(
    `[processImage] preset=${resolutionPreset} | ` +
    `downsample: ${origW}×${origH} → ${targetWidth ?? origW}px → ${origW}×${origH} | ` +
    `jpegQ=${jpegQuality} | output=${(info.size / 1024).toFixed(1)} KB`
  );

  return {
    originalWidth:   origW,
    originalHeight:  origH,
    processedWidth:  info.width,
    processedHeight: info.height,
    processedSize:   info.size,
    resolutionPreset,
  };
};

module.exports = { processImage };