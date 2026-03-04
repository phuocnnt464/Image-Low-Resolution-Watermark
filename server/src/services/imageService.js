const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png');

const WATERMARK_RATIO = 0.15;
const PADDING         = 15;

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
 * scalePercent (10–90):
 *   10 = Ít mất chi tiết  → resolution cao, quality cao → file nặng
 *   90 = Mất nhiều chi tiết → resolution thấp, quality thấp → file nhẹ
 *
 * Công thức (t = 0 ít mất, t = 1 mất nhiều):
 *   t                = (scalePercent - 10) / 80
 *   downsampleRatio  = 1 - t * 0.90        → 1.00 (10%) → 0.10 (90%)
 *   jpegQuality      = round(92 - t * 74)  → 92   (10%) → 18   (90%)
 */
const processImage = async (
  inputPath,
  outputPath,
  scalePercent = 50,
  watermarkPath = null,
  watermarkPosition = 'bottom-left'
) => {
  const wmPath = watermarkPath || DEFAULT_WATERMARK_PATH;

  const meta   = await sharp(inputPath).metadata();
  const origW  = meta.width;
  const origH  = meta.height;
  const format = meta.format;

  // ── Tính tham số degradation ─────────────────────────────────────────────
  // t: 0.0 = ít mất (scalePercent=10), 1.0 = mất nhiều (scalePercent=90)
  const t = (scalePercent - 10) / 80;

  // 1. Downsample resolution: t=0 → 100%, t=1 → 10%
  const downsampleRatio = 1 - t * 0.90;
  const midW = Math.max(2, Math.round(origW * downsampleRatio));
  const midH = Math.max(2, Math.round(origH * downsampleRatio));

  // 2. Encode quality: t=0 → 92, t=1 → 18
  const encodeQuality = Math.round(92 - t * 74);

  // ── Degraded: resize xuống → resize lên lại (giữ nguyên kích thước pixel) ─
  const degradedBuffer = await sharp(inputPath)
    .resize(midW, midH, {
      kernel: sharp.kernel.nearest,   // nearest-neighbor: giữ hard pixel edge
      withoutEnlargement: false,
    })
    .resize(origW, origH, {
      kernel: sharp.kernel.nearest,
      withoutEnlargement: false,
    })
    .toBuffer();

  // ── Watermark ────────────────────────────────────────────────────────────
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

  // ── Encode output ─────────────────────────────────────────────────────────
  let pipeline = sharp(degradedBuffer)
    .composite(compositeOptions)
    .withMetadata({ density: 72 });

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({
        quality: encodeQuality,
        progressive: true,
        mozjpeg: true,
      });
      break;

    case 'png':
      // PNG: dùng palette (giảm bit depth màu) + compressionLevel tăng dần
      pipeline = pipeline.png({
        compressionLevel: Math.min(9, Math.round(1 + t * 8)),  // 1 → 9
        palette: t >= 0.25,       // bật giảm màu từ scalePercent >= 30
        colours: t >= 0.25
          ? Math.max(16, Math.round(256 - t * 224))  // 256 → 32
          : 256,
        dither: Math.min(1, t * 1.2),
      });
      break;

    case 'webp':
      pipeline = pipeline.webp({
        quality: encodeQuality,
        effort: Math.round(t * 6),  // 0 → 6 (nén nặng hơn)
      });
      break;

    default:
      pipeline = pipeline.jpeg({
        quality: encodeQuality,
        progressive: true,
        mozjpeg: true,
      });
  }

  const info = await pipeline.toFile(outputPath);

  console.log(
    `[processImage] scale=${scalePercent}% | t=${t.toFixed(2)} | ` +
    `downsample=${(downsampleRatio * 100).toFixed(0)}% (${midW}×${midH}→${origW}×${origH}) | ` +
    `quality=${encodeQuality} | output=${info.size} bytes`
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