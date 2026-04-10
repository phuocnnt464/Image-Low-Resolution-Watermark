const path   = require('path')
const fs     = require('fs')
const { processVideo, BITRATE_OPTIONS } = require('../services/videoService')
const { createZip }                     = require('../utils/zipHelper')
require('dotenv').config()

const UPLOAD_DIR        = process.env.UPLOAD_DIR     || path.resolve(__dirname, '../../public/uploads')
const DEFAULT_WATERMARK = process.env.WATERMARK_PATH || path.resolve(__dirname, '../../assets/watermark.png')
const VALID_PRESETS     = ['Original', '4K', '1080p', '720p', '480p', '360p', '240p']

const cleanupFiles = (paths) => {
  paths.forEach(p => { try { if (p && fs.existsSync(p)) fs.unlinkSync(p) } catch {} })
}

// ─── Job store — lưu trạng thái từng job trong memory ────────────────────────
// Map: jobId → { rawPath, watermarkPath, preset, position, bitrate, totalChunks, receivedChunks, originalName, createdAt }
const jobStore = new Map()

// Tự dọn job quá hạn 2 giờ
setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobStore) {
    if (now - job.createdAt > 2 * 60 * 60 * 1000) {
      cleanupFiles([job.rawPath, job.watermarkPath !== DEFAULT_WATERMARK ? job.watermarkPath : null].filter(Boolean))
      jobStore.delete(id)
      console.log(`[job expired] ${id}`)
    }
  }
}, 15 * 60 * 1000)

// ─── Route cũ: POST /api/videos/process ──────────────────────────────────────
const processVideoHandler = async (req, res) => {
  const videoFiles     = req.files?.['video']     || []
  const watermarkFiles = req.files?.['watermark'] || []

  if (videoFiles.length === 0)
    return res.status(400).json({ message: 'Không có video nào được upload' })

  const rawPreset         = req.body.bitratePreset || '720p'
  const bitratePreset     = VALID_PRESETS.includes(rawPreset) ? rawPreset : '720p'
  const watermarkPosition = req.body.watermarkPosition || 'bottom-left'
  const rawBitrate        = req.body.videoBitrate || 'auto'
  const allowedBitrates   = BITRATE_OPTIONS[bitratePreset] ?? ['auto']
  const videoBitrate      = allowedBitrates.includes(rawBitrate) ? rawBitrate : 'auto'

  const hasCustomWatermark = watermarkFiles.length > 0
  const watermarkPath      = hasCustomWatermark ? watermarkFiles[0].path : DEFAULT_WATERMARK
  const inputPaths         = videoFiles.map(f => f.path)
  const wmPaths            = hasCustomWatermark ? [watermarkFiles[0].path] : []
  const processedPaths     = []

  console.log(`[video] preset=${bitratePreset} | bitrate=${videoBitrate} | position=${watermarkPosition}`)

  try {
    for (const file of videoFiles) {
      const baseName   = path.parse(file.originalname).name
      const outputPath = path.join(UPLOAD_DIR, `watermarked-${baseName}-${Date.now()}.mp4`)
      try {
        await processVideo(file.path, outputPath, bitratePreset, watermarkPath, watermarkPosition, videoBitrate)
        processedPaths.push({ outputPath, downloadName: `watermarked-${baseName}.mp4` })
      } catch (e) {
        console.error(`Lỗi xử lý ${file.originalname}:`, e.message)
        try { fs.unlinkSync(outputPath) } catch {}
      }
    }

    if (processedPaths.length === 0) {
      cleanupFiles([...inputPaths, ...wmPaths])
      return res.status(500).json({ message: 'Tất cả video đều xử lý thất bại' })
    }

    const { outputPath, downloadName } = processedPaths[0]
    res.download(outputPath, downloadName, () => cleanupFiles([...inputPaths, ...wmPaths, outputPath]))

  } catch (err) {
    cleanupFiles([...inputPaths, ...wmPaths])
    res.status(500).json({ message: 'Lỗi xử lý video', error: err.message })
  }
}

// ─── POST /api/videos/init — Bước 1: tạo job ─────────────────────────────────
const initJob = (req, res) => {
  const jobId           = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const rawPreset       = req.body.bitratePreset || '720p'
  const bitratePreset   = VALID_PRESETS.includes(rawPreset) ? rawPreset : '720p'
  const rawBitrate      = req.body.videoBitrate || 'auto'
  const allowedBitrates = BITRATE_OPTIONS[bitratePreset] ?? ['auto']
  const videoBitrate    = allowedBitrates.includes(rawBitrate) ? rawBitrate : 'auto'
  const totalChunks     = parseInt(req.body.totalChunks) || 1
  const originalName    = req.body.originalName || 'video.mp4'

  // rawPath: file thô sẽ được ghép dần từng chunk vào đây
  const rawPath = path.join(UPLOAD_DIR, `${jobId}_raw.mp4`)

  jobStore.set(jobId, {
    createdAt:       Date.now(),
    rawPath,
    watermarkPath:   DEFAULT_WATERMARK,
    bitratePreset,
    videoBitrate,
    watermarkPosition: req.body.watermarkPosition || 'bottom-left',
    totalChunks,
    originalName,
    receivedChunks:  0,
  })

  console.log(`[init] jobId=${jobId} | preset=${bitratePreset} | totalChunks=${totalChunks} | file=${originalName}`)
  res.json({ jobId })
}

// ─── POST /api/videos/chunk — Bước 2: nhận chunk, append vào rawPath ─────────
const receiveChunk = async (req, res) => {
  const { jobId, chunkIndex } = req.body
  const chunkFile     = req.files?.['chunk']?.[0]
  const watermarkFile = req.files?.['watermark']?.[0]

  if (!jobId || !chunkFile)
    return res.status(400).json({ message: 'Thiếu jobId hoặc chunk' })

  const job = jobStore.get(jobId)
  if (!job)
    return res.status(404).json({ message: 'Job không tồn tại hoặc đã hết hạn' })

  // Chunk 0 có thể kèm watermark
  if (watermarkFile) {
    // Xóa watermark cũ nếu có (không phải default)
    if (job.watermarkPath !== DEFAULT_WATERMARK) cleanupFiles([job.watermarkPath])
    job.watermarkPath = watermarkFile.path
  }

  try {
    // Append chunk vào rawPath (dùng stream để không load vào RAM)
    await new Promise((resolve, reject) => {
      const readStream  = fs.createReadStream(chunkFile.path)
      const writeStream = fs.createWriteStream(job.rawPath, { flags: 'a' }) // 'a' = append
      readStream.pipe(writeStream)
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
      readStream.on('error', reject)
    })

    // Xóa chunk tạm ngay sau khi append
    cleanupFiles([chunkFile.path])

    job.receivedChunks++
    console.log(`[chunk] jobId=${jobId} | idx=${chunkIndex} | received=${job.receivedChunks}/${job.totalChunks} | size=${(chunkFile.size/1024/1024).toFixed(1)}MB`)

    res.json({ ok: true, receivedChunks: job.receivedChunks, totalChunks: job.totalChunks })

  } catch (err) {
    cleanupFiles([chunkFile.path])
    console.error(`[chunk error] ${err.message}`)
    res.status(500).json({ message: `Lỗi nhận chunk ${chunkIndex}`, error: err.message })
  }
}

// ─── POST /api/videos/finalize — Bước 3: encode + stream download ─────────────
const finalizeJob = async (req, res) => {
  const { jobId } = req.body
  const job = jobStore.get(jobId)

  if (!job)
    return res.status(404).json({ message: 'Job không tồn tại hoặc đã hết hạn' })

  if (job.receivedChunks < job.totalChunks) {
    return res.status(400).json({
      message: `Chưa nhận đủ chunk (${job.receivedChunks}/${job.totalChunks})`
    })
  }

  if (!fs.existsSync(job.rawPath))
    return res.status(400).json({ message: 'File raw không tồn tại' })

  const baseName   = path.parse(job.originalName).name
  const outputPath = path.join(UPLOAD_DIR, `watermarked-${baseName}-${Date.now()}.mp4`)

  console.log(`[finalize] jobId=${jobId} | rawSize=${(fs.statSync(job.rawPath).size/1024/1024).toFixed(1)}MB`)

  try {
    // Encode 1 lần duy nhất từ rawPath — chất lượng preset đầy đủ
    await processVideo(
      job.rawPath,
      outputPath,
      job.bitratePreset,
      job.watermarkPath,
      job.watermarkPosition,
      job.videoBitrate,
    )

    const downloadName = `watermarked-${baseName}.mp4`
    res.download(outputPath, downloadName, () => {
      // Cleanup sau khi download xong
      cleanupFiles([job.rawPath, outputPath])
      if (job.watermarkPath !== DEFAULT_WATERMARK) cleanupFiles([job.watermarkPath])
      jobStore.delete(jobId)
    })

  } catch (err) {
    console.error(`[finalize error] ${err.message}`)
    cleanupFiles([job.rawPath, outputPath])
    if (job.watermarkPath !== DEFAULT_WATERMARK) cleanupFiles([job.watermarkPath])
    jobStore.delete(jobId)
    res.status(500).json({ message: 'Lỗi encode video', error: err.message })
  }
}

module.exports = { processVideoHandler, initJob, receiveChunk, finalizeJob }