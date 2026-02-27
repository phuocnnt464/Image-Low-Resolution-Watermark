const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ImageModel {
  /**
   * Create new image record
   */
  static async create(imageData) {
    try {
      const id = uuidv4();
      const query = `
        INSERT INTO images 
        (id, original_name, processed_name, original_size, processed_size, mime_type, width, height, has_watermark)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;

      const values = [
        id,
        imageData.original_name,
        imageData.processed_name,
        imageData.original_size || 0,
        imageData.processed_size || 0,
        imageData.mime_type || 'image/webp',
        imageData.width || 0,
        imageData.height || 0,
        imageData.has_watermark !== false
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating image:', error);
      throw error;
    }
  }

  /**
   * Get all images with pagination
   */
  static async getAll(limit = 50, offset = 0) {
    try {
      const query = `
        SELECT * FROM images 
        ORDER BY uploaded_at DESC 
        LIMIT $1 OFFSET $2;
      `;
      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching images:', error);
      throw error;
    }
  }

  /**
   * Get image by ID
   */
  static async getById(id) {
    try {
      const query = 'SELECT * FROM images WHERE id = $1;';
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching image:', error);
      throw error;
    }
  }

  /**
   * Update image record
   */
  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updateData).forEach(key => {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      });

      values.push(id);
      const query = `
        UPDATE images 
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *;
      `;

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating image:', error);
      throw error;
    }
  }

  /**
   * Delete image record
   */
  static async delete(id) {
    try {
      const query = 'DELETE FROM images WHERE id = $1 RETURNING *;';
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }

  /**
   * Get total count of images
   */
  static async getTotal() {
    try {
      const query = 'SELECT COUNT(*) FROM images;';
      const result = await pool.query(query);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error getting total count:', error);
      throw error;
    }
  }
}

module.exports = ImageModel;