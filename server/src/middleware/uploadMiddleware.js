const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
require('dotenv').config();

const uploadDir = process.env.UPLOAD_DIR || './public/uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext  = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true);
  else cb(new Error('Chỉ hỗ trợ file ảnh: JPEG, PNG, WEBP'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || 50) * 1024 * 1024,
    files: 21, // tối đa 20 ảnh + 1 watermark
  },
});

// upload.fields: nhận cả 'images' (nhiều) + 'watermark' (1 file)
const uploadFields = upload.fields([
  { name: 'images',    maxCount: 20 },
  { name: 'watermark', maxCount: 1  },
]);

module.exports = { upload, uploadFields };