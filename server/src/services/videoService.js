const ffmpeg      = require('fluent-ffmpeg')
const ffmpegPath  = require('ffmpeg-static')
const ffprobePath = require('ffprobe-static').path
const fs          = require('fs')
const path        = require('path')
require('dotenv').config()

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const DEFAULT_WATERMARK = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png')

const PRESETS = {
  'Original': { crf: 18, scale: null  },  
  '4K':       { crf: 18, scale: 3840  },
  '1080p':    { crf: 20, scale: 1920  },
  '720p':     { crf: 22, scale: 1280  },
  '480p':     { crf: 24, scale: 854   },
  '360p':     { crf: 26, scale: 640   },
  '240p':     { crf: 28, scale: 426   },
}

// Audio bitrate theo preset (thấp hơn = nhỏ hơn, đủ nghe)
const AUDIO_BITRATE = {
  'Original': '192k',
  '4K':       '192k',
  '1080p':    '192k',
  '720p':     '128k',
  '480p':     '96k',
  '360p':     '64k',
  '240p':     '48k',
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
      const { crf, scale } = PRESETS[preset] ?? PRESETS['720p']
      const audioBitrate = AUDIO_BITRATE[preset] ?? '128k'
      const overlayExpr = OVERLAY_POSITIONS[wmPosition] || OVERLAY_POSITIONS['bottom-left']

      let logoW = null
      if (hasWm) {
        const { width: origW } = await getVideoSize(inputPath)
        const finalVideoW = (scale !== null && origW > scale) ? scale : origW
        logoW = Math.max(2, Math.floor(finalVideoW * 0.20 / 2) * 2)
      }

      const cmd     = ffmpeg(inputPath)
      const filters = []

      // Bước 1: Scale video
      if (scale !== null) {
        filters.push(`[0:v]scale=w=if(gt(iw\\,${scale})\\,${scale}\\,iw):h=-2[scaled]`)
      } else {
        filters.push('[0:v]null[scaled]')
      }

      // Bước 2: Watermark
      if (hasWm) {
        cmd.input(wm)
        filters.push(`[1:v]scale=w=${logoW}:h=-2[wm]`)
        filters.push(`[scaled][wm]overlay=${overlayExpr}[out]`)
      } else {
        filters.push('[scaled]null[out]')
      }

      cmd.complexFilter(filters, 'out')

      // Bước 3: Video codec — tối ưu tốc độ encode
      cmd.outputOptions([
        '-c:v libx264',
        '-preset ultrafast',   
        '-tune fastdecode',    
        `-crf ${crf}`,        
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-threads 0',          
      ])

      // Bước 4: Audio
      cmd.outputOptions(['-map 0:a?', '-c:a aac', `-b:a ${audioBitrate}`])

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