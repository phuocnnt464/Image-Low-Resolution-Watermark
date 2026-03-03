-- Tạo database
CREATE DATABASE image_watermark_db;

-- Kết nối vào database
\c image_watermark_db

-- Tạo bảng lưu lịch sử xử lý ảnh
CREATE TABLE image_processing_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_filename   VARCHAR(255) NOT NULL,
    processed_filename  VARCHAR(255),
    original_size       BIGINT,         -- bytes
    processed_size      BIGINT,         -- bytes
    original_width      INTEGER,
    original_height     INTEGER,
    processed_width     INTEGER,
    processed_height    INTEGER,
    scale_percent       INTEGER DEFAULT 50,
    watermark_applied   BOOLEAN DEFAULT TRUE,
    status              VARCHAR(20) DEFAULT 'pending', -- pending | done | failed
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);