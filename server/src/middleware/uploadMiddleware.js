const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
require('dotenv').config()

const uploadDir = process.env.UPLOAD_DIR || './public/uploads'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

// ── Storage dùng chung cho cả image lẫn video ──────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

// ── File filter: chỉ ảnh ───────────────────────────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/
  const ext  = allowed.test(path.extname(file.originalname).toLowerCase())
  const mime = allowed.test(file.mimetype)
  if (ext && mime) return cb(null, true)
  cb(new Error('Chỉ hỗ trợ file ảnh: JPEG, PNG, WEBP'))
}

// ── File filter: video + watermark ────────────────────────────────────────
const videoFilter = (req, file, cb) => {
  if (file.fieldname === 'watermark') {
    const allowed = /jpeg|jpg|png|webp/
    if (allowed.test(path.extname(file.originalname).toLowerCase())) return cb(null, true)
    return cb(new Error('Watermark phải là ảnh: JPEG, PNG, WEBP'))
  }
  const allowedVideo = /mp4|mov|avi|mkv|webm|flv|wmv/
  if (allowedVideo.test(path.extname(file.originalname).toLowerCase())) return cb(null, true)
  cb(new Error('Video không hỗ trợ. Chỉ chấp nhận: MP4, MOV, AVI, MKV, WEBM, FLV, WMV'))
}

// ── Multer: ảnh (20 ảnh + 1 watermark) ────────────────────────────────────
const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE  || 50)   * 1024 * 1024,
    files: 21,
  },
})

// ── Multer: video (10 video + 1 watermark) ─────────────────────────────
const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_VIDEO_SIZE || 2048) * 1024 * 1024,
    files: 11,
  },
})

const uploadFields = uploadImage.fields([
  { name: 'images',    maxCount: 20 },
  { name: 'watermark', maxCount: 1  },
])

const uploadVideoFields = uploadVideo.fields([
  { name: 'video',     maxCount: 10 }, 
  { name: 'watermark', maxCount: 1  },
])

module.exports = { uploadFields, uploadVideoFields }