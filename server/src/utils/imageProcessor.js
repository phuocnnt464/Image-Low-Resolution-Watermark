const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const uploadDir = path.join(__dirname, '../public/uploads');

class ImageProcessor {
  /**
   * Compress image to lower quality
   */
  static async compressImage(inputPath, quality = 60) {
    try {
      const metadata = await sharp(inputPath).metadata();
      
      const processedName = `processed-${uuidv4()}.webp`;
      const outputPath = path.join(uploadDir, processedName);

      await sharp(inputPath)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: quality })
        .toFile(outputPath);

      return {
        success: true,
        processedName: processedName,
        processedPath: outputPath,
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      console.error('Error compressing image:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get file size in bytes
   */
  static getFileSize(filePath) {
    try {
      return fs.statSync(filePath).size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Delete file from disk
   */
  static deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
}

module.exports = ImageProcessor;