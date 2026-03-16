const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { processVideoHandler } = require('../controllers/videoController');
require('dotenv').config();

const uploadDir = process.env.UPLOAD_DIR || './public/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const videoFilter = (req, file, cb) => {
  // Cho phép cả watermark image lẫn video
  if (file.fieldname === 'watermark') {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    return cb(new Error('Watermark phải là ảnh: JPEG, PNG, WEBP'));
  }
  // Video
  const allowedVideo = /mp4|mov|avi|mkv|webm|flv|wmv/;
  if (allowedVideo.test(path.extname(file.originalname).toLowerCase())) return cb(null, true);
  cb(new Error('Chỉ hỗ trợ: MP4, MOV, AVI, MKV, WEBM, FLV, WMV'));
};

const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: {
    // Video có thể rất nặng, cho phép tối đa 2 GB
    fileSize: parseInt(process.env.MAX_VIDEO_SIZE || 2048) * 1024 * 1024,
    files: 2, // 1 video + 1 watermark
  },
});

const uploadVideoFields = uploadVideo.fields([
  { name: 'video',     maxCount: 1 },
  { name: 'watermark', maxCount: 1 },
]);

router.post('/process', uploadVideoFields, processVideoHandler);

module.exports = router;