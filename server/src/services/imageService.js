const sharp = require('sharp');
const fs    = require('fs');
require('dotenv').config();

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH || './assets/watermark.png';
const WATERMARK_RATIO        = 0.15;
const PADDING                = 15;

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} scalePercent   - % downsample (10=ít mất, 90=mất nhiều)
 * @param {string} watermarkPath  - đường dẫn watermark (user upload hoặc mặc định)
 */
const processImage = async (inputPath, outputPath, scalePercent = 50, watermarkPath = null) => {
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

  // Watermark sắc nét — render hoàn toàn độc lập
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

    compositeOptions = [{
      input: watermarkBuffer,
      left:  PADDING,
      top:   Math.max(0, origH - wmH - PADDING),
    }];
  } else {
    console.warn(`⚠️  Watermark không tìm thấy: ${wmPath}`);
  }

  let pipeline = sharp(degradedBuffer)
    .composite(compositeOptions)
    .withMetadata({ density: 72 });

  switch (format) {
    case 'jpeg': pipeline = pipeline.jpeg({ quality: 100, mozjpeg: true }); break;
    case 'png':  pipeline = pipeline.png({ compressionLevel: 6, colours: 256 }); break;
    case 'webp': pipeline = pipeline.webp({ quality: 100 }); break;
    default:     pipeline = pipeline.jpeg({ quality: 100 });
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