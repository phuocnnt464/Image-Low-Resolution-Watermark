const ImageModel = require('../models/Image');
const ImageProcessor = require('../utils/imageProcessor');
const WatermarkService = require('../utils/watermark');
const path = require('path');
const fs = require('fs');

class ImageController {
  /**
   * Handle image upload
   */
  static async upload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file uploaded'
        });
      }

      const originalPath = req.file.path;
      const originalSize = req.file.size;
      const mimeType = req.file.mimetype;

      // Compress image
      const processResult = await ImageProcessor.compressImage(originalPath);
      
      if (!processResult.success) {
        ImageProcessor.deleteFile(originalPath);
        return res.status(500).json({
          success: false,
          message: 'Error compressing image: ' + processResult.error
        });
      }

      // Add watermark if logo file exists
      const watermarkPath = path.join(__dirname, '../public/watermark-logo.png');
      let hasWatermark = false;

      if (fs.existsSync(watermarkPath)) {
        const watermarkResult = await WatermarkService.addWatermark(
          processResult.processedPath,
          watermarkPath
        );
        hasWatermark = watermarkResult.success;
      }

      // Get processed image size
      const processedSize = ImageProcessor.getFileSize(processResult.processedPath);

      // Save to database
      const imageData = {
        original_name: req.file.originalname,
        processed_name: processResult.processedName,
        original_size: originalSize,
        processed_size: processedSize,
        mime_type: mimeType,
        width: processResult.width,
        height: processResult.height,
        has_watermark: hasWatermark
      };

      const savedImage = await ImageModel.create(imageData);

      // Delete original image
      ImageProcessor.deleteFile(originalPath);

      return res.status(201).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          id: savedImage.id,
          original_name: savedImage.original_name,
          processed_name: savedImage.processed_name,
          url: `/uploads/${savedImage.processed_name}`,
          original_size: savedImage.original_size,
          processed_size: savedImage.processed_size,
          width: savedImage.width,
          height: savedImage.height,
          has_watermark: savedImage.has_watermark,
          uploaded_at: savedImage.uploaded_at
        }
      });
    } catch (error) {
      if (req.file) {
        ImageProcessor.deleteFile(req.file.path);
      }
      console.error('Error uploading image:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error: ' + error.message
      });
    }
  }

  /**
   * Get all images
   */
  static async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const images = await ImageModel.getAll(limit, offset);
      const total = await ImageModel.getTotal();

      const formattedImages = images.map(img => ({
        id: img.id,
        original_name: img.original_name,
        processed_name: img.processed_name,
        url: `/uploads/${img.processed_name}`,
        original_size: img.original_size,
        processed_size: img.processed_size,
        width: img.width,
        height: img.height,
        has_watermark: img.has_watermark,
        uploaded_at: img.uploaded_at
      }));

      return res.json({
        success: true,
        data: formattedImages,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching images:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error: ' + error.message
      });
    }
  }

  /**
   * Get image by ID
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const image = await ImageModel.getById(id);

      if (!image) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }

      return res.json({
        success: true,
        data: {
          id: image.id,
          original_name: image.original_name,
          processed_name: image.processed_name,
          url: `/uploads/${image.processed_name}`,
          original_size: image.original_size,
          processed_size: image.processed_size,
          width: image.width,
          height: image.height,
          has_watermark: image.has_watermark,
          uploaded_at: image.uploaded_at
        }
      });
    } catch (error) {
      console.error('Error fetching image:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error: ' + error.message
      });
    }
  }

  /**
   * Delete image
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const image = await ImageModel.getById(id);

      if (!image) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }

      // Delete file
      const filePath = path.join(__dirname, '../public/uploads', image.processed_name);
      ImageProcessor.deleteFile(filePath);

      // Delete from database
      await ImageModel.delete(id);

      return res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error: ' + error.message
      });
    }
  }

  /**
   * Add text watermark to image
   */
  static async addTextWatermark(req, res) {
    try {
      const { id } = req.params;
      const { text, fontSize, textColor } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: 'Text watermark cannot be empty'
        });
      }

      const image = await ImageModel.getById(id);
      if (!image) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }

      const filePath = path.join(__dirname, '../public/uploads', image.processed_name);
      
      // Add text watermark
      const result = await WatermarkService.addTextWatermark(
        filePath,
        text,
        { fontSize, textColor }
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Error adding watermark: ' + result.error
        });
      }

      // Update database
      await ImageModel.update(id, { has_watermark: true });

      return res.json({
        success: true,
        message: 'Watermark added successfully',
        data: {
          id: image.id,
          url: `/uploads/${image.processed_name}`
        }
      });
    } catch (error) {
      console.error('Error adding text watermark:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error: ' + error.message
      });
    }
  }

  /**
   * Get statistics
   */
  static async getStats(req, res) {
    try {
      const total = await ImageModel.getTotal();
      
      return res.json({
        success: true,
        data: {
          total_images: total
        }
      });
    } catch (error) {
      console.error('Error getting statistics:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error: ' + error.message
      });
    }
  }
}

module.exports = ImageController;