const pool = require('../config/database');

const ImageModel = {
  /**
   * Tạo một bản ghi mới (status = 'pending')
   */
  create: async ({
    id, originalFilename, processedFilename,
    originalSize, processedSize,
    originalWidth, originalHeight,
    processedWidth, processedHeight,
    scalePercent, watermarkApplied, status,
  }) => {
    const { rows } = await pool.query(
      `INSERT INTO image_processing_history
         (id, original_filename, processed_filename,
          original_size, processed_size,
          original_width, original_height,
          processed_width, processed_height,
          scale_percent, watermark_applied, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        id, originalFilename, processedFilename,
        originalSize, processedSize,
        originalWidth, originalHeight,
        processedWidth, processedHeight,
        scalePercent, watermarkApplied, status,
      ]
    );
    return rows[0];
  },

  /**
   * Cập nhật trạng thái và thông tin sau khi xử lý xong
   */
  updateById: async (id, fields) => {
    const setClauses = Object.keys(fields)
      .map((key, i) => `${toSnakeCase(key)} = $${i + 2}`)
      .join(', ');
    const values = [id, ...Object.values(fields)];

    const { rows } = await pool.query(
      `UPDATE image_processing_history
       SET ${setClauses}
       WHERE id = $1
       RETURNING *`,
      values
    );
    return rows[0];
  },

  /**
   * Lấy tất cả lịch sử, sắp xếp mới nhất trước
   */
  findAll: async (limit = 50) => {
    const { rows } = await pool.query(
      `SELECT * FROM image_processing_history
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },

  /**
   * Lấy một bản ghi theo ID
   */
  findById: async (id) => {
    const { rows } = await pool.query(
      `SELECT * FROM image_processing_history WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Xóa một bản ghi theo ID
   */
  deleteById: async (id) => {
    const { rows } = await pool.query(
      `DELETE FROM image_processing_history WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },
};

// Helper: chuyển camelCase → snake_case cho tên cột DB
const toSnakeCase = (str) =>
  str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

module.exports = ImageModel;