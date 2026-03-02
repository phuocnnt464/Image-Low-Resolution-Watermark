const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');
const ImageModel       = require('../models/imageModel');
const { processImage } = require('../services/imageService');
const { createZip }    = require('../utils/zipHelper');
require('dotenv').config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/uploads';

// ─── Helper cleanup ──────────────────────────────────────────────────────────
const cleanupFiles = (paths) => {
  paths.forEach((p) => {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  });
};

// ─── POST /api/images/process ────────────────────────────────────────────────
const processImages = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Không có file nào được upload' });
  }

  const scalePercent = Math.min(100, Math.max(1, parseInt(req.body.scalePercent) || 50));
  const inputPaths   = req.files.map((f) => f.path);
  const processedPaths = [];

  try {
    for (const file of req.files) {
      const id         = uuidv4();
      // ✅ Dùng file.originalname để lấy extension đúng
      const ext        = path.extname(file.originalname) || path.extname(file.filename);
      const outputName = `processed-${id}${ext}`;
      const outputPath = path.join(UPLOAD_DIR, outputName);

      // 1. Tạo record pending
      await ImageModel.create({
        id,
        originalFilename:  file.originalname,
        processedFilename: outputName,
        originalSize:      file.size,
        processedSize:     null,
        originalWidth:     null,
        originalHeight:    null,
        processedWidth:    null,
        processedHeight:   null,
        scalePercent,
        watermarkApplied:  true,
        status:            'pending',
      });

      try {
        // 2. Xử lý ảnh
        const result = await processImage(file.path, outputPath, scalePercent);
        processedPaths.push(outputPath);

        // 3. Cập nhật record → done
        await ImageModel.updateById(id, {
          processedSize:   result.processedSize,
          originalWidth:   result.originalWidth,
          originalHeight:  result.originalHeight,
          processedWidth:  result.processedWidth,
          processedHeight: result.processedHeight,
          status:          'done',
        });
      } catch (imgErr) {
        // ✅ Lỗi từng ảnh → đánh dấu failed, không dừng cả batch
        console.error(`❌ Lỗi xử lý ${file.originalname}:`, imgErr.message);
        await ImageModel.markFailed(id);
      }
    }

    if (processedPaths.length === 0) {
      cleanupFiles(inputPaths);
      return res.status(500).json({ message: 'Tất cả ảnh đều xử lý thất bại' });
    }

    // 4. Trả về file
    if (processedPaths.length === 1) {
      res.download(processedPaths[0], (err) => {
        // ✅ Cleanup dù download thành công hay lỗi
        cleanupFiles([...inputPaths, ...processedPaths]);
        if (err) console.error('Download error:', err);
      });
    } else {
      const zipPath = path.join(UPLOAD_DIR, `watermarked-${Date.now()}.zip`);
      await createZip(processedPaths, zipPath);
      res.download(zipPath, 'watermarked-images.zip', (err) => {
        // ✅ Cleanup dù download thành công hay lỗi
        cleanupFiles([...inputPaths, ...processedPaths, zipPath]);
        if (err) console.error('Download error:', err);
      });
    }
  } catch (err) {
    console.error('❌ processImages error:', err);
    cleanupFiles(inputPaths);
    res.status(500).json({ message: 'Lỗi xử lý ảnh', error: err.message });
  }
};

// ─── GET /api/images/history ─────────────────────────────────────────────────
const getHistory = async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const data  = await ImageModel.findAll(limit);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy lịch sử', error: err.message });
  }
};

// ─── GET /api/images/history/:id ─────────────────────────────────────────────
const getHistoryById = async (req, res) => {
  try {
    const record = await ImageModel.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    res.json({ data: record });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy dữ liệu', error: err.message });
  }
};

// ─── DELETE /api/images/history/:id ──────────────────────────────────────────
const deleteHistory = async (req, res) => {
  try {
    const deleted = await ImageModel.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    res.json({ message: 'Đã xóa thành công', data: deleted });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa dữ liệu', error: err.message });
  }
};

module.exports = { processImages, getHistory, getHistoryById, deleteHistory };