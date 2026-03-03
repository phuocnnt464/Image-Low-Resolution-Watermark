const sharp = require('sharp');
const fs    = require('fs');
require('dotenv').config();

const WATERMARK_PATH  = process.env.WATERMARK_PATH || './assets/watermark.png';
const WATERMARK_RATIO = 0.15; // watermark rộng tối đa 15% chiều rộng ảnh gốc
const PADDING         = 10;   // px cách mép

/**
 * Xử lý ảnh:
 *  - Giữ nguyên dimension (width × height)
 *  - Giữ nguyên format gốc (jpeg/png/webp)
 *  - Giảm resolution bằng downsample → upsample (mất chi tiết pixel)
 *  - Giảm DPI metadata xuống 72
 *  - Watermark luôn sắc nét (render độc lập từ file gốc)
 *
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} scalePercent - % downsample (10=ít mất, 90=mất nhiều chi tiết)
 */
const processImage = async (inputPath, outputPath, scalePercent = 50) => {
  // 1. Đọc metadata ảnh gốc
  const meta   = await sharp(inputPath).metadata();
  const origW  = meta.width;
  const origH  = meta.height;
  const format = meta.format; // 'jpeg' | 'png' | 'webp'

  // 2. Tính kích thước trung gian để downsample
  //    scalePercent=50 → thu nhỏ còn 50% → upsample lại 100%
  //    → mất chi tiết pixel nhưng giữ nguyên dimension
  const midW = Math.max(1, Math.round(origW * scalePercent / 100));
  const midH = Math.max(1, Math.round(origH * scalePercent / 100));

  // 3. Downsample → upsample về kích thước gốc
  //    kernel: nearest = pixel vỡ rõ, cubic = mềm hơn
  const degradedBuffer = await sharp(inputPath)
    .resize(midW, midH, { kernel: sharp.kernel.nearest })  // thu nhỏ, mất chi tiết
    .resize(origW, origH, { kernel: sharp.kernel.nearest }) // phóng to lại, giữ pixelate
    .toBuffer();

  // 4. Chuẩn bị watermark SẮC NÉT từ file gốc (hoàn toàn độc lập)
  let compositeOptions = [];

  if (fs.existsSync(WATERMARK_PATH)) {
    const wmMeta  = await sharp(WATERMARK_PATH).metadata();

    // Scale watermark theo kích thước ảnh GỐC
    const wmMaxW  = Math.round(origW * WATERMARK_RATIO);
    const wmScale = Math.min(1, wmMaxW / wmMeta.width);
    const wmW     = Math.max(1, Math.round(wmMeta.width  * wmScale));
    const wmH     = Math.max(1, Math.round(wmMeta.height * wmScale));

    // Render watermark sắc nét — không qua bất kỳ blur/resize nào khác
    const watermarkBuffer = await sharp(WATERMARK_PATH)
      .resize(wmW, wmH, { kernel: sharp.kernel.lanczos3 }) // lanczos3: sắc nét nhất
      .toBuffer();

    compositeOptions = [{
      input: watermarkBuffer,
      left:  PADDING,
      top:   Math.max(0, origH - wmH - PADDING), // góc trái dưới
    }];
  } else {
    console.warn(`⚠️ Watermark không tìm thấy: ${WATERMARK_PATH}`);
  }

  // 5. Composite watermark vào ảnh đã degrade
  //    Xuất đúng format gốc, quality cao để không mất thêm
  let pipeline = sharp(degradedBuffer)
    .composite(compositeOptions)
    .withMetadata({ density: 60 }); // giảm DPI xuống 60

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: 100, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 6, colours: 256 }); // giảm bit-depth
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality: 100  });
      break;
    default:
      pipeline = pipeline.jpeg({ quality: 100 });
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