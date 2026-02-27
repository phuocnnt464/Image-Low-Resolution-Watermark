const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

class WatermarkService {
  /**
   * Add image watermark logo
   */
  static async addWatermark(imagePath, watermarkPath) {
    try {
      // Check if watermark file exists
      if (!fs.existsSync(watermarkPath)) {
        console.warn('Watermark file not found:', watermarkPath);
        return { success: false, error: 'Watermark file not found' };
      }

      // Resize watermark
      const watermarkBuffer = await sharp(watermarkPath)
        .resize(120, 120, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();

      // Add watermark to image (bottom-right corner)
      await sharp(imagePath)
        .composite([
          {
            input: watermarkBuffer,
            gravity: 'southeast',
            offset: { left: 10, top: 10 }
          }
        ])
        .toFile(imagePath + '.with-watermark.tmp');

      // Rename file
      fs.renameSync(imagePath + '.with-watermark.tmp', imagePath);

      return { success: true };
    } catch (error) {
      console.error('Error adding watermark:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add text watermark
   */
  static async addTextWatermark(imagePath, text, options = {}) {
    try {
      const fontSize = options.fontSize || 40;
      const textColor = options.textColor || '#ffffff';

      // Create SVG with text
      const svg = Buffer.from(`
        <svg width="500" height="100" xmlns="http://www.w3.org/2000/svg">
          <text 
            x="10" y="60" 
            font-size="${fontSize}" 
            fill="${textColor}" 
            font-weight="bold"
            font-family="Arial"
          >${text}</text>
        </svg>
      `);

      const metadata = await sharp(imagePath).metadata();
      const textWidth = Math.min(metadata.width * 0.3, 500);
      
      const scaledText = await sharp(svg)
        .resize(Math.floor(textWidth), Math.floor(textWidth / 5), {
          fit: 'contain'
        })
        .toBuffer();

      await sharp(imagePath)
        .composite([
          {
            input: scaledText,
            gravity: 'southeast',
            offset: { left: 10, top: 10 }
          }
        ])
        .toFile(imagePath + '.with-text.tmp');

      fs.renameSync(imagePath + '.with-text.tmp', imagePath);

      return { success: true };
    } catch (error) {
      console.error('Error adding text watermark:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WatermarkService;