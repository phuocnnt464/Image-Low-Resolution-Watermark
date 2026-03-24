const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png');

const WATERMARK_RATIO = 0.20;
const PADDING         = 15;

// Resolution: chỉ thay đổi width, quality cố định theo preset riêng
const RESOLUTION_PRESETS = {
  'Original': { targetWidth: null },
  '4K':       { targetWidth: 3840 },
  'QHD':      { targetWidth: 2560 },
  'FHD':      { targetWidth: 1920 },
  'HD':       { targetWidth: 1280 },
  'SD':       { targetWidth: 854  },
  'LD':       { targetWidth: 480  },
  'Tiny':     { targetWidth: 240  },
}

/**
 * Bit depth config — chỉ dùng JPG/PNG/WebP (không TIFF), max 24-bit
 *
 *  8-bit  → JPG quality thấp (72) — file nhỏ nhất, nén nhiều nhất
 * 16-bit  → PNG với colourspace rgb16 — 16-bit per channel thật sự
 * 24-bit  → JPG/PNG/WebP quality cao (95) — 8bit×3ch = chuẩn màn hình
 *
 * Sự thay đổi thấy được:
 *  - 8-bit JPG vs 24-bit JPG: file size khác rõ rệt, màu sắc nén khác nhau
 *  - 16-bit PNG: file size lớn hơn 8-bit PNG, metadata hiện "16-bit"
 *  - 24-bit JPG: chất lượng cao nhất trong 3 option
 */
const BIT_DEPTH_CONFIG = {
  '8bit': {
    // JPG quality thấp — nén nhiều, file nhỏ, thấy rõ artifact
    jpgQuality:  72,
    webpQuality: 72,
    pngDepth:    8,
    use16bitPng: false,
  },
  '16bit': {
    // PNG 16-bit colourspace thật (chỉ có PNG support, JPG/WebP fallback quality cao)
    jpgQuality:  88,
    webpQuality: 88,
    pngDepth:    16,
    use16bitPng: true,   // ← chỉ áp dụng khi input là PNG
  },
  '24bit': {
    // Chất lượng cao nhất — 8bit×3 kênh RGB, chuẩn màn hình
    jpgQuality:  95,
    webpQuality: 95,
    pngDepth:    8,
    use16bitPng: false,
  },
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
 * @param {string} resolutionPreset  'Original'|'4K'|'QHD'|'FHD'|'HD'|'SD'|'LD'|'Tiny'
 * @param {string|null} watermarkPath
 * @param {string} watermarkPosition
 * @param {string} bitDepth          '8bit'|'16bit'|'24bit'
 */
const processImage = async (
  inputPath,
  outputPath,
  resolutionPreset  = 'FHD',
  watermarkPath     = null,
  watermarkPosition = 'bottom-left',
  bitDepth          = '24bit'
) => {
  const wmPath = watermarkPath || DEFAULT_WATERMARK_PATH;

  const meta  = await sharp(inputPath).metadata();
  const origW = meta.width;
  const origH = meta.height;
  const format = meta.format; // 'jpeg' | 'png' | 'webp'

  const preset   = RESOLUTION_PRESETS[resolutionPreset] ?? RESOLUTION_PRESETS['FHD'];
  const bdConfig = BIT_DEPTH_CONFIG[bitDepth]           ?? BIT_DEPTH_CONFIG['24bit'];

  // ── Bước 1: Resize ──────────────────────────────────────────────────────────
  let pipeline = sharp(inputPath);

  if (preset.targetWidth !== null) {
    pipeline = pipeline.resize({
      width: preset.targetWidth,
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    });
  }

  // ── Bước 2: Bit depth — chỉ áp rgb16 cho PNG ────────────────────────────────
  // JPG và WebP không hỗ trợ 16-bit, nên chỉ PNG mới dùng colourspace rgb16
  const applyRgb16 = bdConfig.use16bitPng && (format === 'png')
  if (applyRgb16) {
    pipeline = pipeline.toColourspace('rgb16')
  }

  // ── Bước 3: Encode ra buffer đúng format+depth ───────────────────────────────
  let encodedBuffer;

  if (format === 'jpeg') {
    encodedBuffer = await pipeline
      .jpeg({ quality: bdConfig.jpgQuality, progressive: true, mozjpeg: true })
      .toBuffer();
  } else if (format === 'png') {
    encodedBuffer = await pipeline
      .png({ compressionLevel: 7, palette: false })
      .toBuffer();
  } else if (format === 'webp') {
    encodedBuffer = await pipeline
      .webp({ quality: bdConfig.webpQuality, lossless: false })
      .toBuffer();
  } else {
    // fallback → jpeg
    encodedBuffer = await pipeline
      .jpeg({ quality: bdConfig.jpgQuality, progressive: true, mozjpeg: true })
      .toBuffer();
  }

  // ── Bước 4: Kích thước thực sau resize ──────────────────────────────────────
  const resizedMeta = await sharp(encodedBuffer).metadata();
  const resW = resizedMeta.width;
  const resH = resizedMeta.height;

  // ── Bước 5: Watermark ────────────────────────────────────────────────────────
  let compositeOptions = [];

  if (fs.existsSync(wmPath)) {
    const wmMeta  = await sharp(wmPath).metadata();
    const wmMaxW  = Math.round(resW * WATERMARK_RATIO);
    const wmScale = Math.min(1, wmMaxW / wmMeta.width);
    const wmW     = Math.max(1, Math.round(wmMeta.width  * wmScale));
    const wmH     = Math.max(1, Math.round(wmMeta.height * wmScale));

    const watermarkBuffer = await sharp(wmPath)
      .resize(wmW, wmH, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();

    const { left, top } = calcPosition(watermarkPosition, resW, resH, wmW, wmH, PADDING);
    compositeOptions = [{ input: watermarkBuffer, left, top }];
  } else {
    console.warn(`[imageService] Watermark không tìm thấy: ${wmPath}`);
  }

  // ── Bước 6: Composite + encode output (cùng format input) ───────────────────
  let outputPipeline = sharp(encodedBuffer)
    .composite(compositeOptions)
    .withMetadata();

  if (format === 'jpeg') {
    outputPipeline = outputPipeline.jpeg({ quality: bdConfig.jpgQuality, progressive: true, mozjpeg: true });
  } else if (format === 'png') {
    outputPipeline = outputPipeline.png({ compressionLevel: 7, palette: false });
  } else if (format === 'webp') {
    outputPipeline = outputPipeline.webp({ quality: bdConfig.webpQuality, lossless: false });
  } else {
    outputPipeline = outputPipeline.jpeg({ quality: bdConfig.jpgQuality, progressive: true, mozjpeg: true });
  }

  const info = await outputPipeline.toFile(outputPath);

  console.log(
    `[processImage] preset=${resolutionPreset} | bitDepth=${bitDepth} | ` +
    `format=${format} | jpgQ=${bdConfig.jpgQuality} | rgb16=${applyRgb16} | ` +
    `${origW}×${origH} → ${info.width}×${info.height} | ` +
    `size=${(info.size / 1024).toFixed(1)} KB`
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