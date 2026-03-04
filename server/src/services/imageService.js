const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png');

const WATERMARK_RATIO = 0.15;
const PADDING         = 15;

/**
 * Tính tọa độ (left, top) của watermark theo vị trí
 * @param {string} position
 */
const calcPosition = (position, origW, origH, wmW, wmH, padding) => {
  const cx = Math.round((origW - wmW) / 2)  // căn ngang giữa
  const cy = Math.round((origH - wmH) / 2)  // căn dọc giữa

  const positions = {
    'top-left':      { left: padding,              top: padding },
    'top-center':    { left: cx,                   top: padding },
    'top-right':     { left: origW - wmW - padding, top: padding },
    'center-left':   { left: padding,                top: cy },
    'center':        { left: cx,                     top: cy },
    'center-right':  { left: origW - wmW - padding, top: cy },
    'bottom-left':   { left: padding,              top: origH - wmH - padding },
    'bottom-center': { left: cx,                   top: origH - wmH - padding },
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
 * @param {number} scalePercent
 * @param {string} watermarkPath
 * @param {string} watermarkPosition
 */
const processImage = async (inputPath, outputPath, scalePercent = 50, watermarkPath = null, watermarkPosition = 'bottom-left') => {
  const wmPath = watermarkPath || DEFAULT_WATERMARK_PATH;

  const meta   = await sharp(inputPath).metadata();
  const origW  = meta.width;
  const origH  = meta.height;
  const format = meta.format;

  // Downsample → upsample (giảm resolution, giữ dimension)
  const midW = Math.max(1, Math.round(origW * scalePercent / 100));
  const midH = Math.max(1, Math.round(origH * scalePercent / 100));

  const degradedBuffer = await sharp(inputPath)
    .resize(midW, midH, { kernel: sharp.kernel.nearest })
    .resize(origW, origH, { kernel: sharp.kernel.nearest })
    .toBuffer();

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

  let pipeline = sharp(degradedBuffer)
    .composite(compositeOptions)
    .withMetadata({ density: 72 });

  switch (format) {
    case 'jpeg': pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true }); break;
    case 'png':  pipeline = pipeline.png({ compressionLevel: 6, colours: 256 }); break;
    case 'webp': pipeline = pipeline.webp({ quality: 90 }); break;
    default:     pipeline = pipeline.jpeg({ quality: 90 });
  }

  const info = await pipeline.toFile(outputPath);

  return {
    originalWidth:   origW,
    originalHeight:  origH,
    processedWidth:  info.width,
    processedHeight: info.height,
    processedSize:   info.size,
  };
};

module.exports = { processImage };