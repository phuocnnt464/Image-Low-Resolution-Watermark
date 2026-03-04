const pool = require('../config/database');

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

// ── CREATE ─────────────────────────────────────────────────────────────────
const create = async ({
  id,
  originalFilename,
  processedFilename,
  originalSize,
  processedSize,
  originalWidth,
  originalHeight,
  processedWidth,
  processedHeight,
  resolutionPreset,   
  watermarkApplied,
  status,
}) => {
  const sql = `
    INSERT INTO image_processing_history (
      id, original_filename, processed_filename,
      original_size, processed_size,
      original_width, original_height,
      processed_width, processed_height,
      resolution_preset, watermark_applied, status
    ) VALUES (
      $1, $2, $3,
      $4, $5,
      $6, $7,
      $8, $9,
      $10, $11, $12
    )
    RETURNING *
  `;
  const values = [
    id, originalFilename, processedFilename,
    originalSize, processedSize,
    originalWidth, originalHeight,
    processedWidth, processedHeight,
    resolutionPreset ?? 'FHD', watermarkApplied, status,
  ];
  const { rows } = await pool.query(sql, values);
  return rows[0];
};

// ── UPDATE BY ID ──────────────────────────────────────────────────────────────
const updateById = async (id, fields) => {
  const keys   = Object.keys(fields);
  const values = Object.values(fields);

  if (keys.length === 0) return null;

  const setClauses = keys
    .map((key, i) => `${toSnakeCase(key)} = $${i + 2}`)
    .join(', ');

  const sql = `
    UPDATE image_processing_history
    SET ${setClauses}
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await pool.query(sql, [id, ...values]);
  return rows[0] || null;
};

// ── FIND ALL ──────────────────────────────────────────────────────────────────
const findAll = async (limit = 50) => {
  const { rows } = await pool.query(
    `SELECT * FROM image_processing_history
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
};

// ── FIND BY ID ────────────────────────────────────────────────────────────────
const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT * FROM image_processing_history WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

// ── DELETE BY ID ──────────────────────────────────────────────────────────────
const deleteById = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM image_processing_history WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
};

// ── MARK FAILED ───────────────────────────────────────────────────────────────
const markFailed = async (id) => {
  const { rows } = await pool.query(
    `UPDATE image_processing_history
     SET status = 'failed'
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] || null;
};

module.exports = { create, updateById, findAll, findById, deleteById, markFailed };