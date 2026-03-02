const sharp = require('sharp');
const fs    = require('fs');
require('dotenv').config();

const WATERMARK_PATH  = process.env.WATERMARK_PATH || './assets/watermark.png';
const WATERMARK_RATIO = 0.10;  // watermark rộng tối đa 10% chiều rộng ảnh
const PADDING         = 10;    // px cách mép

/**
 * Xử lý một ảnh: resize + chèn watermark góc trái dưới
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} scalePercent - % kích thước so gốc (1–100)
 */
const processImage = async (inputPath, outputPath, scalePercent = 60) => {
  // 1. Đọc metadata ảnh gốc
  const meta = await sharp(inputPath).metadata();
  const origW = meta.width;
  const origH = meta.height;

  // 2. Tính kích thước mới
  const newWidth  = Math.max(1, Math.round(origW * scalePercent / 100));
  const newHeight = Math.max(1, Math.round(origH * scalePercent / 100));

  // 3. Resize
  let pipeline = sharp(inputPath).resize(newWidth, newHeight);

  // 4. Chèn watermark
  if (fs.existsSync(WATERMARK_PATH)) {
    const wmMeta = await sharp(WATERMARK_PATH).metadata();

    // Tính kích thước watermark (tối đa WATERMARK_RATIO % chiều rộng ảnh)
    const wmMaxW  = Math.round(newWidth * WATERMARK_RATIO);
    const wmScale = Math.min(1, wmMaxW / wmMeta.width);
    const wmW     = Math.max(1, Math.round(wmMeta.width  * wmScale));
    const wmH     = Math.max(1, Math.round(wmMeta.height * wmScale));

    const watermarkBuffer = await sharp(WATERMARK_PATH)
      .resize(wmW, wmH)
      .toBuffer();

    // ✅ Dùng left + top (KHÔNG dùng gravity cùng lúc)
    // Góc trái dưới = left: PADDING, top: newHeight - wmH - PADDING
    const left = PADDING;
    const top  = Math.max(0, newHeight - wmH - PADDING);

    pipeline = pipeline.composite([{
      input: watermarkBuffer,
      left,
      top,
    }]);
  } else {
    console.warn(`⚠️  Watermark không tìm thấy: ${WATERMARK_PATH}`);
  }

  // 5. Xuất file
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