const ffmpeg     = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')
const ffprobePath = require('ffprobe-static').path
const fs         = require('fs')
const path       = require('path')
require('dotenv').config()

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const DEFAULT_WATERMARK = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png')

// Các preset bitrate — null = giữ nguyên gốc
const PRESETS = {
  'Original': { video: null,     audio: null,    scale: null },
  '4K':       { video: '20000k', audio: '320k',  scale: 3840 },
  '1080p':    { video: '8000k',  audio: '192k',  scale: 1920 },
  '720p':     { video: '4000k',  audio: '128k',  scale: 1280 },
  '480p':     { video: '2000k',  audio: '96k',   scale: 854  },
  '360p':     { video: '1000k',  audio: '64k',   scale: 640  },
  '240p':     { video: '500k',   audio: '48k',   scale: 426  },
}

// Vị trí overlay watermark trong FFmpeg expression
const OVERLAY_POSITIONS = {
  'top-left':      'x=15:y=15',
  'top-center':    'x=(W-w)/2:y=15',
  'top-right':     'x=W-w-15:y=15',
  'center-left':   'x=15:y=(H-h)/2',
  'center':        'x=(W-w)/2:y=(H-h)/2',
  'center-right':  'x=W-w-15:y=(H-h)/2',
  'bottom-left':   'x=15:y=H-h-15',
  'bottom-center': 'x=(W-w)/2:y=H-h-15',
  'bottom-right':  'x=W-w-15:y=H-h-15',
}

// Lấy width/height video bằng ffprobe
function getVideoSize(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const stream = metadata.streams.find(s => s.codec_type === 'video')
      if (!stream) return reject(new Error('Không tìm thấy video stream'))
      resolve({ width: stream.width, height: stream.height })
    })
  })
}

const processVideo = async (inputPath, outputPath, preset = '720p', wmPath = null, wmPosition = 'bottom-left') => {
  return new Promise(async (resolve, reject) => {
    try {
      const wm          = wmPath || DEFAULT_WATERMARK
      const hasWm       = fs.existsSync(wm)
      const { video, audio, scale } = PRESETS[preset] ?? PRESETS['720p']
      const overlayExpr = OVERLAY_POSITIONS[wmPosition] || OVERLAY_POSITIONS['bottom-left']

      // ── Tính kích thước video sau khi scale để biết logo width cần bao nhiêu ──
      // Giống imageService: logo width = 20% video width, height tự giữ tỉ lệ
      let logoW = null
      if (hasWm) {
        const { width: origW } = await getVideoSize(inputPath)
        // Video width sau preset (nếu gốc nhỏ hơn preset thì giữ nguyên gốc)
        const finalVideoW = (scale !== null && origW > scale) ? scale : origW
        // Logo width = 20% video width, chia hết 2 (yêu cầu libx264)
        logoW = Math.max(2, Math.floor(finalVideoW * 0.20 / 2) * 2)
      }

      const cmd = ffmpeg(inputPath)
      const filters = []

      // Bước 1: Scale video (hoặc passthrough nếu Original)
      if (scale !== null) {
        filters.push(`[0:v]scale=w=if(gt(iw\\,${scale})\\,${scale}\\,iw):h=-2[scaled]`)
      } else {
        filters.push('[0:v]null[scaled]')
      }

      // Bước 2: Thêm watermark logo nếu có
      if (hasWm) {
        cmd.input(wm)
        // Scale logo về đúng logoW px chiều ngang, h=-2 giữ tỉ lệ gốc tự động
        // → giống Sharp: wmW = resW * 0.20, wmH = wmW * (logo_h/logo_w)
        filters.push(`[1:v]scale=w=${logoW}:h=-2[wm]`)
        filters.push(`[scaled][wm]overlay=${overlayExpr}[out]`)
      } else {
        filters.push('[scaled]null[out]')
      }

      cmd.complexFilter(filters, 'out')

      // Bước 3: Video codec
      cmd.outputOptions(['-c:v libx264', '-preset fast', '-pix_fmt yuv420p', '-movflags +faststart'])
      if (video) {
        cmd.outputOptions([`-b:v ${video}`, `-maxrate ${video}`, `-bufsize ${video}`])
      }

      // Bước 4: Audio
      cmd.outputOptions(['-map 0:a?', '-c:a aac', `-b:a ${audio || '192k'}`])

      cmd
        .output(outputPath)
        .on('start', c  => console.log('[FFmpeg] start:', c.slice(0, 120) + '...'))
        .on('progress', p => p.percent && process.stdout.write(`\r[FFmpeg] ${p.percent.toFixed(1)}%`))
        .on('end', () => {
          console.log(`\n[FFmpeg] done → ${outputPath}`)
          resolve({ processedSize: fs.statSync(outputPath).size, preset })
        })
        .on('error', err => {
          console.error('[FFmpeg] error:', err.message)
          reject(err)
        })
        .run()

    } catch (err) {
      reject(err)
    }
  })
}

module.exports = { processVideo }