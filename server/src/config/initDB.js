const pool = require('./database');

const initDB = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS image_processing_history (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      original_filename  VARCHAR(255) NOT NULL,
      processed_filename VARCHAR(255),
      original_size      BIGINT,
      processed_size     BIGINT,
      original_width     INTEGER,
      original_height    INTEGER,
      processed_width    INTEGER,
      processed_height   INTEGER,
      scale_percent      INTEGER DEFAULT 50,
      watermark_applied  BOOLEAN DEFAULT TRUE,
      status             VARCHAR(20) DEFAULT 'pending',
      created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Table image_processing_history ready');
  } catch (err) {
    console.error('❌ Failed to init DB:', err);
    throw err;
  }
};

module.exports = initDB;