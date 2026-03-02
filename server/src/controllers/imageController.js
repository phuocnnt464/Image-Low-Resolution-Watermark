const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 }   = require('uuid');
const ImageModel        = require('../models/imageModel');       // ← dùng Model
const { processImage }  = require('../services/imageService');
const { createZip }     = require('../utils/zipHelper');
require('dotenv').config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/uploads';

// POST /api/images/process
const processImages = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Không có file nào được upload' });
  }

  const scalePercent   = parseInt(req.body.scalePercent) || 50;
  const processedPaths = [];

  try {
    for (const file of req.files) {
      const id         = uuidv4();
      const outputName = `processed-${id}${path.extname(file.filename)}`;
      const outputPath = path.join(UPLOAD_DIR, outputName);

      // 1. Tạo record trạng thái pending trước
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

      // 2. Xử lý ảnh (Service layer)
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
    }

    // 4. Trả về file
    if (processedPaths.length === 1) {
      res.download(processedPaths[0], (err) => {
        if (!err) cleanupFiles([req.files[0].path, processedPaths[0]]);
      });
    } else {
      const zipPath = path.join(UPLOAD_DIR, `watermarked-${Date.now()}.zip`);
      await createZip(processedPaths, zipPath);
      res.download(zipPath, 'watermarked-images.zip', (err) => {
        if (!err) cleanupFiles([...req.files.map((f) => f.path), ...processedPaths, zipPath]);
      });
    }
  } catch (err) {
    console.error('❌ processImages error:', err);
    res.status(500).json({ message: 'Lỗi xử lý ảnh', error: err.message });
  }
};

// GET /api/images/history
const getHistory = async (req, res) => {
  try {
    const data = await ImageModel.findAll(50);  // ← dùng Model
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy lịch sử', error: err.message });
  }
};

// GET /api/images/history/:id
const getHistoryById = async (req, res) => {
  try {
    const record = await ImageModel.findById(req.params.id);  // ← dùng Model
    if (!record) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json({ data: record });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy dữ liệu', error: err.message });
  }
};

// DELETE /api/images/history/:id
const deleteHistory = async (req, res) => {
  try {
    const deleted = await ImageModel.deleteById(req.params.id);  // ← dùng Model
    if (!deleted) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json({ message: 'Đã xóa', data: deleted });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa dữ liệu', error: err.message });
  }
};

const cleanupFiles = (paths) => {
  paths.forEach((p) => { try { fs.unlinkSync(p); } catch {} });
};

module.exports = { processImages, getHistory, getHistoryById, deleteHistory };