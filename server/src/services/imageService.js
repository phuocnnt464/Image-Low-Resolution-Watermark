const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png');

const WATERMARK_RATIO = 0.20;
const PADDING         = 15;

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

/**
 * Bit depth → số levels posterize cho sharp
 * sharp.posterise(levels) giảm số giá trị màu mỗi kênh
 *   8-bit  = 256 levels → giữ nguyên (không posterize)
 *  12-bit  = 16 levels  (2^12 / 256 = 16)  → giảm nhẹ
 *  24-bit  = posterize(64) → dùng làm "giả 24-bit per channel"
 *   ⚠️  NOTE: "24-bit" thực ra là 8-bit/channel × 3 kênh (RGB) = tiêu chuẩn
 *             Ở đây ta dùng posterize để tạo hiệu ứng "giảm màu" có chủ ý
 *  32-bit  = posterize(8)
 *  64-bit  = posterize(4)  (hiệu ứng rõ nhất)
 */
const BIT_DEPTH_LEVELS = {
  '8bit':  null,  // giữ nguyên, không posterize
  '12bit': 16,
  '24bit': null,  // 24-bit = chuẩn (8bit/channel × 3), giữ nguyên
  '32bit': 8,
  '64bit': 4,
}

// ── 16-bit PNG: sharp hỗ trợ toPixels16() qua .toColourspace('rgb16') ──────
// Chỉ có PNG mới có thể lưu 16-bit thực sự
const NATIVE_16BIT_FORMATS = new Set(['png'])

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
 * @param {string} bitDepth          - '8bit'|'12bit'|'24bit'|'32bit'|'64bit'  (default: '8bit')
 */
const processImage = async (
  inputPath,
  outputPath,
  resolutionPreset  = 'FHD',
  watermarkPath     = null,
  watermarkPosition = 'bottom-left',
  bitDepth          = '8bit'           // ← tham số mới
) => {
  const wmPath = watermarkPath || DEFAULT_WATERMARK_PATH;

  const meta   = await sharp(inputPath).metadata();
  const origW  = meta.width;
  const origH  = meta.height;
  const format = meta.format;

  const preset = RESOLUTION_PRESETS[resolutionPreset] ?? RESOLUTION_PRESETS['FHD'];
  const { targetWidth, jpegQuality, webpQuality, pngCompression } = preset;

  // ── Bước 1: Resize ──────────────────────────────────────────────────────────
  let pipeline = sharp(inputPath);

  if (targetWidth !== null) {
    pipeline = pipeline.resize({
      width: targetWidth,
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    });
  }

  // ── Bước 2: Bit depth xử lý ─────────────────────────────────────────────────
  const posterizeLevels = BIT_DEPTH_LEVELS[bitDepth] ?? null

  // '12bit' với PNG → dùng colourspace rgb16 (16-bit native thật sự)
  const use16bitPng = (bitDepth === '12bit') && NATIVE_16BIT_FORMATS.has(format)

  if (use16bitPng) {
    // PNG 16-bit per channel thật (≈ 12-bit RAW quality)
    pipeline = pipeline.toColourspace('rgb16')
  } else if (posterizeLevels !== null) {
    // Posterize: giảm dải màu xuống N levels (hiệu ứng giảm bit depth)
    pipeline = pipeline.normalise().posterise(posterizeLevels)
  }
  // null = 8-bit / 24-bit → không làm gì, giữ nguyên

  // ── Bước 3: Buffer sau resize + bit depth ───────────────────────────────────
  const resizedBuffer = await pipeline.toBuffer({ resolveWithObject: true });
  const resW = resizedBuffer.info.width;
  const resH = resizedBuffer.info.height;

  // ── Bước 4: Watermark ───────────────────────────────────────────────────────
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

  // ── Bước 5: Composite + encode output ───────────────────────────────────────
  let outputPipeline = sharp(resizedBuffer.data)
    .composite(compositeOptions)
    .withMetadata();

  switch (format) {
    case 'jpeg':
      outputPipeline = outputPipeline.jpeg({
        quality: jpegQuality,
        progressive: true,
        mozjpeg: true,
      });
      break;

    case 'png':
      outputPipeline = outputPipeline.png({
        compressionLevel: pngCompression,
        palette: false,
        // 16-bit PNG: sharp sẽ tự giữ colourspace rgb16 khi encode
      });
      break;

    case 'webp':
      outputPipeline = outputPipeline.webp({
        quality: webpQuality,
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
    `[processImage] preset=${resolutionPreset} | bitDepth=${bitDepth} | ` +
    `${origW}×${origH} → ${info.width}×${info.height} | ` +
    `output=${(info.size / 1024).toFixed(1)} KB`
  );

  return {
    originalWidth:   origW,
    originalHeight:  origH,
    processedWidth:  info.width,
    processedHeight: info.height,
    processedSize:   info.size,
    resolutionPreset,
    bitDepth,
  };
};

module.exports = { processImage };