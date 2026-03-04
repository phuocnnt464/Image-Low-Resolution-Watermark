const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');
const ImageModel       = require('../models/imageModel');
const { processImage } = require('../services/imageService');
const { createZip }    = require('../utils/zipHelper');
require('dotenv').config();

const UPLOAD_DIR        = process.env.UPLOAD_DIR    || path.resolve(__dirname, '../../public/uploads');
const DEFAULT_WATERMARK = process.env.WATERMARK_PATH || path.resolve(__dirname, '../../assets/watermark.png');

const VALID_PRESETS = ['Original', '4K', 'QHD', 'FHD', 'HD', 'SD', 'LD', 'Tiny'];

const cleanupFiles = (paths) => {
  paths.forEach((p) => {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  });
};

// ─── POST /api/images/process ────────────────────────────────────────────────
const processImages = async (req, res) => {
  const imageFiles     = req.files?.['images']    || [];
  const watermarkFiles = req.files?.['watermark'] || [];

  if (imageFiles.length === 0) {
    return res.status(400).json({ message: 'Không có ảnh nào được upload' });
  }

  const rawPreset        = req.body.resolutionPreset || 'FHD';
  const resolutionPreset = VALID_PRESETS.includes(rawPreset) ? rawPreset : 'FHD';
  const watermarkPosition = req.body.watermarkPosition || 'bottom-left';
  const inputPaths        = imageFiles.map((f) => f.path);

  const hasCustomWatermark = watermarkFiles.length > 0;
  const watermarkPath = hasCustomWatermark
    ? watermarkFiles[0].path
    : DEFAULT_WATERMARK;

  console.log(`preset: ${resolutionPreset} | position: ${watermarkPosition}`);
  console.log(`watermark: ${hasCustomWatermark ? `custom → ${watermarkFiles[0]?.originalname}` : `default → ${DEFAULT_WATERMARK}`}`);

  const processedPaths = [];

  try {
    for (const file of imageFiles) {
      const id         = uuidv4();
      const ext        = path.extname(file.originalname) || path.extname(file.filename);
      const outputName = `processed-${id}${ext}`;
      const outputPath = path.join(UPLOAD_DIR, outputName);

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
        resolutionPreset,          // ← lưu preset thay scalePercent
        watermarkApplied:  hasCustomWatermark,
        status:            'pending',
      });

      try {
        const result = await processImage(
          file.path,
          outputPath,
          resolutionPreset,
          watermarkPath,
          watermarkPosition
        );
        processedPaths.push(outputPath);

        await ImageModel.updateById(id, {
          processedSize:   result.processedSize,
          originalWidth:   result.originalWidth,
          originalHeight:  result.originalHeight,
          processedWidth:  result.processedWidth,
          processedHeight: result.processedHeight,
          status:          'done',
        });
      } catch (imgErr) {
        console.error(`Lỗi xử lý ${file.originalname}:`, imgErr.message);
        await ImageModel.markFailed(id);
      }
    }

    if (processedPaths.length === 0) {
      cleanupFiles([...inputPaths, ...watermarkFiles.map(f => f.path)]);
      return res.status(500).json({ message: 'Tất cả ảnh đều xử lý thất bại' });
    }

    if (processedPaths.length === 1) {
      res.download(processedPaths[0], (err) => {
        cleanupFiles([...inputPaths, ...watermarkFiles.map(f => f.path), ...processedPaths]);
        if (err) console.error('Download error:', err);
      });
    } else {
      const zipPath = path.join(UPLOAD_DIR, `watermarked-${Date.now()}.zip`);
      await createZip(processedPaths, zipPath);
      res.download(zipPath, 'watermarked-images.zip', (err) => {
        cleanupFiles([...inputPaths, ...watermarkFiles.map(f => f.path), ...processedPaths, zipPath]);
        if (err) console.error('Download error:', err);
      });
    }
  } catch (err) {
    console.error('processImages error:', err);
    cleanupFiles([...inputPaths, ...watermarkFiles.map(f => f.path)]);
    res.status(500).json({ message: 'Lỗi xử lý ảnh', error: err.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const data  = await ImageModel.findAll(limit);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy lịch sử', error: err.message });
  }
};

const getHistoryById = async (req, res) => {
  try {
    const record = await ImageModel.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    res.json({ data: record });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy dữ liệu', error: err.message });
  }
};

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