const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const WATERMARK_PATH = process.env.WATERMARK_PATH || './assets/watermark.png';
const WATERMARK_MAX_WIDTH = 150; // px, kích thước tối đa watermark

/**
 * Xử lý một ảnh: resize giảm resolution + chèn watermark góc trái dưới
 * @param {string} inputPath   - Đường dẫn ảnh gốc
 * @param {string} outputPath  - Đường dẫn ảnh xuất ra
 * @param {number} scalePercent - % kích thước so với gốc (mặc định 50%)
 */
const processImage = async (inputPath, outputPath, scalePercent = 50) => {
  // 1. Đọc metadata ảnh gốc
  const meta = await sharp(inputPath).metadata();
  const { width: origW, height: origH } = meta;

  // 2. Tính kích thước mới
  const newWidth  = Math.round(origW * scalePercent / 100);
  const newHeight = Math.round(origH * scalePercent / 100);

  // 3. Resize ảnh
  let pipeline = sharp(inputPath).resize(newWidth, newHeight);

  // 4. Chèn watermark nếu file tồn tại
  if (fs.existsSync(WATERMARK_PATH)) {
    // Scale watermark sao cho không vượt quá 20% chiều rộng ảnh đã resize
    const wmMaxW = Math.min(WATERMARK_MAX_WIDTH, Math.round(newWidth * 0.2));
    const wmMeta  = await sharp(WATERMARK_PATH).metadata();
    const wmScale = wmMaxW / wmMeta.width;
    const wmW     = Math.round(wmMeta.width  * wmScale);
    const wmH     = Math.round(wmMeta.height * wmScale);

    const watermarkBuffer = await sharp(WATERMARK_PATH)
      .resize(wmW, wmH)
      .toBuffer();

    const padding = 10; // px cách mép
    pipeline = pipeline.composite([{
      input:   watermarkBuffer,
      gravity: 'southwest',        // góc trái dưới
      left:    padding,
      bottom:  padding,
    }]);
  } else {
    console.warn(`⚠️  Watermark not found at ${WATERMARK_PATH}, skipping`);
  }

  // 5. Xuất ảnh
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