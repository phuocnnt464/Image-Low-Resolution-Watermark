const express = require('express')
const router  = express.Router()
const { uploadVideoFields, uploadChunkFields } = require('../middleware/uploadMiddleware')
const {
  processVideoHandler,
  initJob,
  receiveChunk,
  finalizeJob,
} = require('../controllers/videoController')

// Route cũ — giữ lại cho file nhỏ ≤ 90MB
router.post('/process',  uploadVideoFields, processVideoHandler)

// Routes mới — chunked upload cho file lớn
router.post('/init',     initJob)                       // bước 1: tạo job
router.post('/chunk',    uploadChunkFields, receiveChunk) // bước 2: gửi từng chunk
router.post('/finalize', finalizeJob)                   // bước 3: encode + download

module.exports = router