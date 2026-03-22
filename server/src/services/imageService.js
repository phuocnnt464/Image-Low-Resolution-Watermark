const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png');

const WATERMARK_RATIO = 0.20;
const PADDING         = 15;

/**
 * Bảng preset — theo đúng mẫu mẫu generateProMatrix:
 *
 *   targetWidth : resize ảnh về đúng width này (withoutEnlargement: true)
 *                 null = giữ nguyên kích thước gốc (Original)
 *   jpegQuality : quality JPEG/WebP output — giữ 100 để không mất thêm, hoặc giảm nhẹ
 *
 * Khác với cách cũ (down→up), lần này output sẽ CÓ kích thước nhỏ hơn thật sự
 * → file nhỏ hơn, resolution thấp hơn, rõ ràng khi xem thuộc tính ảnh.
 *
 * Nếu ảnh gốc nhỏ hơn targetWidth → withoutEnlargement giữ nguyên kích thước gốc.
 */
const RESOLUTION_PRESETS = {
  'Original': { targetWidth: null,  jpegQuality: 100, webpQuality: 100, pngCompression: 1 },
  '4K':       { targetWidth: 3840,  jpegQuality: 100, webpQuality: 100, pngCompression: 1 },
  'QHD':      { targetWidth: 2560,  jpegQuality: 100, webpQuality: 100, pngCompression: 2 },
  'FHD':      { targetWidth: 1920,  jpegQuality: 100, webpQuality: 100, pngCompression: 3 },
  'HD':       { targetWidth: 1280,  jpegQuality: 100, webpQuality: 100, pngCompression: 4 },
  'SD':       { targetWidth: 854,   jpegQuality: 100, webpQuality: 100, pngCompression: 5 },
  'LD':       { targetWidth: 480,   jpegQuality: 100, webpQuality: 100, pngCompression: 6 },
  'Tiny':     { targetWidth: 240,   jpegQuality: 100, webpQuality: 100, pngCompression: 7 },
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

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string} resolutionPreset  - 'Original'|'4K'|'QHD'|'FHD'|'HD'|'SD'|'LD'|'Tiny'
 * @param {string|null} watermarkPath
 * @param {string} watermarkPosition
 */
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

  // ── Tham số preset ─────────────────────────────────────────────────────────
  const preset = RESOLUTION_PRESETS[resolutionPreset] ?? RESOLUTION_PRESETS['FHD'];
  const { targetWidth, jpegQuality, webpQuality, pngCompression } = preset;

  // ── Bước 1: Resize xuống targetWidth (giữ tỉ lệ, không phóng to) ──────────
  // Đây là pipeline chính, output SẼ CÓ kích thước nhỏ hơn nếu targetWidth < origW
  let pipeline = sharp(inputPath);

  if (targetWidth !== null) {
    pipeline = pipeline.resize({
      width: targetWidth,
      withoutEnlargement: true,   // nếu ảnh gốc nhỏ hơn targetWidth → giữ nguyên
      kernel: sharp.kernel.lanczos3,
    });
  }
  // targetWidth === null (Original) → không resize, giữ kích thước gốc

  // ── Bước 2: Lấy metadata sau resize để tính vị trí watermark ──────────────
  // Cần biết kích thước thực tế sau resize để đặt watermark đúng chỗ
  const resizedBuffer = await pipeline.toBuffer({ resolveWithObject: true });
  const resW = resizedBuffer.info.width;
  const resH = resizedBuffer.info.height;

  // ── Bước 3: Watermark (scale theo kích thước sau resize) ───────────────────
  let compositeOptions = [];

  if (fs.existsSync(wmPath)) {
    const wmMeta  = await sharp(wmPath).metadata();
    const wmMaxW  = Math.round(resW * WATERMARK_RATIO);
    const wmScale = Math.min(1, wmMaxW / wmMeta.width);
    const wmW     = Math.max(1, Math.round(wmMeta.width  * wmScale));
    const wmH     = Math.max(1, Math.round(wmMeta.height * wmScale));

    const watermarkBuffer = await sharp(wmPath)
      .resize(wmW, wmH, { kernel: sharp.kernel.lanczos3 })
      .toBuffer();

    const { left, top } = calcPosition(watermarkPosition, resW, resH, wmW, wmH, PADDING);
    compositeOptions = [{ input: watermarkBuffer, left, top }];
  } else {
    console.warn(`Watermark không tìm thấy: ${wmPath}`);
  }

  // ── Bước 4: Composite + encode output với quality 100% ─────────────────────
  let outputPipeline = sharp(resizedBuffer.data)
    .composite(compositeOptions)
    .withMetadata();   // giữ toàn bộ EXIF/metadata gốc

  switch (format) {
    case 'jpeg':
      outputPipeline = outputPipeline.jpeg({
        quality: jpegQuality,       // 100 = không nén thêm
        progressive: true,
        mozjpeg: true,
      });
      break;

    case 'png':
      outputPipeline = outputPipeline.png({
        compressionLevel: pngCompression,
        // Không dùng palette — giữ full bit depth (không giảm màu)
        palette: false,
      });
      break;

    case 'webp':
      outputPipeline = outputPipeline.webp({
        quality: webpQuality,       // 100 = lossless-like
        lossless: jpegQuality === 100,
      });
      break;

    default:
      outputPipeline = outputPipeline.jpeg({
        quality: jpegQuality,
        progressive: true,
        mozjpeg: true,
      });
  }

  const info = await outputPipeline.toFile(outputPath);

  console.log(
    `[processImage] preset=${resolutionPreset} | ` +
    `${origW}×${origH} → ${info.width}×${info.height} | ` +
    `quality=${jpegQuality} | output=${(info.size / 1024).toFixed(1)} KB`
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