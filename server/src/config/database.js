const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'image_watermark_db'
});

// Create table if not exists
pool.query(`
  CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_name VARCHAR(255) NOT NULL,
    processed_name VARCHAR(255) NOT NULL,
    original_size INTEGER,
    processed_size INTEGER,
    mime_type VARCHAR(50),
    width INTEGER,
    height INTEGER,
    has_watermark BOOLEAN DEFAULT true,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`, (err) => {
  if (err) console.error('Error creating table:', err);
  else console.log('Images table is ready');
});

module.exports = pool;