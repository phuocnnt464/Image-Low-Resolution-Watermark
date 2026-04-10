const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
require('dotenv').config()

const uploadDir = process.env.UPLOAD_DIR || './public/uploads'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/
  const ext  = allowed.test(path.extname(file.originalname).toLowerCase())
  const mime = allowed.test(file.mimetype)
  if (ext && mime) return cb(null, true)
  cb(new Error('Chỉ hỗ trợ file ảnh: JPEG, PNG, WEBP'))
}

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

// ── Multer: ảnh ───────────────────────────────────────────────────────────────
const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || 50) * 1024 * 1024, files: 21 },
})

// ── Multer: video thường (route cũ, giữ lại) ──────────────────────────────────
const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: parseInt(process.env.MAX_VIDEO_SIZE || 2048) * 1024 * 1024, files: 2 },
})

// ── Multer: chunk — mỗi request tối đa 95MB (chunk + watermark) ───────────────
// Không dùng videoFilter vì blob chunk không có extension rõ ràng
const uploadChunk = multer({
  storage,
  limits: { fileSize: 95 * 1024 * 1024, files: 2 },
})

const uploadFields = uploadImage.fields([
  { name: 'images',    maxCount: 20 },
  { name: 'watermark', maxCount: 1  },
])

const uploadVideoFields = uploadVideo.fields([
  { name: 'video',     maxCount: 1 },
  { name: 'watermark', maxCount: 1 },
])

// ✅ Mới: nhận chunk + watermark (watermark chỉ gửi 1 lần ở chunk đầu)
const uploadChunkFields = uploadChunk.fields([
  { name: 'chunk',     maxCount: 1 },
  { name: 'watermark', maxCount: 1 },
])

module.exports = { uploadFields, uploadVideoFields, uploadChunkFields }