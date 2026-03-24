const path   = require('path')
const fs     = require('fs')
const { processImage } = require('../services/imageService')
const { createZip }    = require('../utils/zipHelper')
require('dotenv').config()

const UPLOAD_DIR        = process.env.UPLOAD_DIR     || path.resolve(__dirname, '../../public/uploads')
const DEFAULT_WATERMARK = process.env.WATERMARK_PATH || path.resolve(__dirname, '../../assets/watermark.png')

const VALID_PRESETS    = ['Original', '4K', 'QHD', 'FHD', 'HD', 'SD', 'LD', 'Tiny']
const VALID_BIT_DEPTHS = ['8bit', '12bit', '24bit', '32bit', '64bit']   // ← thêm mới

const cleanupFiles = (paths) => {
  paths.forEach((p) => {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  })
}

// ─── POST /api/images/process ────────────────────────────────────────────────
const processImages = async (req, res) => {
  const imageFiles     = req.files?.['images']    || []
  const watermarkFiles = req.files?.['watermark'] || []

  if (imageFiles.length === 0) {
    return res.status(400).json({ message: 'Không có ảnh nào được upload' })
  }

  const rawPreset         = req.body.resolutionPreset || 'FHD'
  const resolutionPreset  = VALID_PRESETS.includes(rawPreset) ? rawPreset : 'FHD'
  const watermarkPosition = req.body.watermarkPosition || 'bottom-left'

  // ── Bit depth (mới) ────────────────────────────────────────────────────────
  const rawBitDepth = req.body.bitDepth || '8bit'
  const bitDepth    = VALID_BIT_DEPTHS.includes(rawBitDepth) ? rawBitDepth : '8bit'

  const inputPaths = imageFiles.map(f => f.path)
  const wmPaths    = watermarkFiles.map(f => f.path)

  const hasCustomWatermark = watermarkFiles.length > 0
  const watermarkPath = hasCustomWatermark ? watermarkFiles[0].path : DEFAULT_WATERMARK

  console.log(`[image] preset=${resolutionPreset} | bitDepth=${bitDepth} | position=${watermarkPosition} | count=${imageFiles.length}`)

  const processedPaths = []

  try {
    for (const file of imageFiles) {
      const ext        = path.extname(file.originalname) || path.extname(file.filename)
      const baseName   = path.parse(file.originalname).name
      const outputName = `watermarked-${baseName}-${Date.now()}${ext}`
      const outputPath = path.join(UPLOAD_DIR, outputName)

      try {
        // ← truyền thêm bitDepth
        await processImage(file.path, outputPath, resolutionPreset, watermarkPath, watermarkPosition, bitDepth)
        processedPaths.push({
          outputPath,
          downloadName: `watermarked-${baseName}${ext}`,
        })
      } catch (imgErr) {
        console.error(`Lỗi xử lý ${file.originalname}:`, imgErr.message)
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch {}
      }
    }

    if (processedPaths.length === 0) {
      cleanupFiles([...inputPaths, ...wmPaths])
      return res.status(500).json({ message: 'Tất cả ảnh đều xử lý thất bại' })
    }

    if (processedPaths.length === 1) {
      const { outputPath, downloadName } = processedPaths[0]
      res.download(outputPath, downloadName, (err) => {
        cleanupFiles([...inputPaths, ...wmPaths, outputPath])
        if (err) console.error('Image download error:', err)
      })
    } else {
      const zipPath = path.join(UPLOAD_DIR, `watermarked-images-${Date.now()}.zip`)
      await createZip(
        processedPaths.map(p => p.outputPath),
        zipPath,
        processedPaths.map(p => p.downloadName),
      )
      res.download(zipPath, 'watermarked-images.zip', (err) => {
        cleanupFiles([...inputPaths, ...wmPaths, ...processedPaths.map(p => p.outputPath), zipPath])
        if (err) console.error('Image zip download error:', err)
      })
    }

  } catch (err) {
    console.error('processImages error:', err)
    cleanupFiles([...inputPaths, ...wmPaths])
    res.status(500).json({ message: 'Lỗi xử lý ảnh', error: err.message })
  }
}

module.exports = { processImages }