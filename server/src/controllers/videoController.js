const path   = require('path')
const fs     = require('fs')
const { processVideo, BITRATE_OPTIONS } = require('../services/videoService')
const { createZip }                     = require('../utils/zipHelper')
require('dotenv').config()

const UPLOAD_DIR        = process.env.UPLOAD_DIR     || path.resolve(__dirname, '../../public/uploads')
const DEFAULT_WATERMARK = process.env.WATERMARK_PATH || path.resolve(__dirname, '../../assets/watermark.png')

const VALID_PRESETS = ['Original', '4K', '1080p', '720p', '480p', '360p', '240p']

const cleanupFiles = (paths) => {
  paths.forEach((p) => {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p) } catch {}
  })
}

// ─── POST /api/videos/process ────────────────────────────────────────────────
const processVideoHandler = async (req, res) => {
  const videoFiles     = req.files?.['video']     || []
  const watermarkFiles = req.files?.['watermark'] || []

  if (videoFiles.length === 0) {
    return res.status(400).json({ message: 'Không có video nào được upload' })
  }

  const rawPreset         = req.body.bitratePreset || '720p'
  const bitratePreset     = VALID_PRESETS.includes(rawPreset) ? rawPreset : '720p'
  const watermarkPosition = req.body.watermarkPosition || 'bottom-left'

  // Validate videoBitrate theo preset
  const rawBitrate      = req.body.videoBitrate || 'auto'
  const allowedBitrates = BITRATE_OPTIONS[bitratePreset] ?? ['auto']
  const videoBitrate    = allowedBitrates.includes(rawBitrate) ? rawBitrate : 'auto'

  const hasCustomWatermark = watermarkFiles.length > 0
  const watermarkPath      = hasCustomWatermark ? watermarkFiles[0].path : DEFAULT_WATERMARK

  const inputPaths     = videoFiles.map(f => f.path)
  const wmPaths        = hasCustomWatermark ? [watermarkFiles[0].path] : []
  const processedPaths = []

  console.log(
    `[video] preset=${bitratePreset} | videoBitrate=${videoBitrate} | ` +
    `position=${watermarkPosition} | count=${videoFiles.length}`
  )

  try {
    for (const file of videoFiles) {
      const baseName   = path.parse(file.originalname).name
      const outputName = `watermarked-${baseName}-${Date.now()}.mp4`
      const outputPath = path.join(UPLOAD_DIR, outputName)

      try {
        await processVideo(
          file.path,
          outputPath,
          bitratePreset,
          watermarkPath,
          watermarkPosition,
          videoBitrate,        // ← truyền thêm tham số mới
        )
        processedPaths.push({
          outputPath,
          downloadName: `watermarked-${baseName}.mp4`,
        })
      } catch (vidErr) {
        console.error(`Lỗi xử lý ${file.originalname}:`, vidErr.message)
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch {}
      }
    }

    if (processedPaths.length === 0) {
      cleanupFiles([...inputPaths, ...wmPaths])
      return res.status(500).json({ message: 'Tất cả video đều xử lý thất bại' })
    }

    if (processedPaths.length === 1) {
      const { outputPath, downloadName } = processedPaths[0]
      res.download(outputPath, downloadName, (err) => {
        cleanupFiles([...inputPaths, ...wmPaths, outputPath])
        if (err) console.error('Video download error:', err)
      })
    } else {
      const zipPath = path.join(UPLOAD_DIR, `watermarked-videos-${Date.now()}.zip`)
      await createZip(
        processedPaths.map(p => p.outputPath),
        zipPath,
        processedPaths.map(p => p.downloadName),
      )
      res.download(zipPath, 'watermarked-videos.zip', (err) => {
        cleanupFiles([...inputPaths, ...wmPaths, ...processedPaths.map(p => p.outputPath), zipPath])
        if (err) console.error('Video zip download error:', err)
      })
    }

  } catch (err) {
    console.error('processVideoHandler error:', err)
    cleanupFiles([...inputPaths, ...wmPaths])
    res.status(500).json({ message: 'Lỗi xử lý video', error: err.message })
  }
}

module.exports = { processVideoHandler }