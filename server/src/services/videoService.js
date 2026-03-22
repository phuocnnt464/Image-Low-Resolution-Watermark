const ffmpeg     = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')
const fs         = require('fs')
const path       = require('path')
require('dotenv').config()

ffmpeg.setFfmpegPath(ffmpegPath)

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

const processVideo = (inputPath, outputPath, preset = '720p', wmPath = null, wmPosition = 'bottom-left') => {
  return new Promise((resolve, reject) => {
    const wm          = wmPath || DEFAULT_WATERMARK
    const hasWm       = fs.existsSync(wm)
    const { video, audio, scale } = PRESETS[preset] ?? PRESETS['720p']
    const overlayExpr = OVERLAY_POSITIONS[wmPosition] || OVERLAY_POSITIONS['bottom-left']

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
      // scale2ref: [input_to_scale=logo][reference=video]
      // - main_w = chiều rộng của REFERENCE (video đã scale) → logo = 20% video width ✅
      // - h=-2   = FFmpeg tự tính chiều cao giữ đúng tỉ lệ gốc của logo ✅
      // - trunc(...*0.20/2)*2 đảm bảo width chia hết 2 (yêu cầu libx264)
      filters.push('[1:v][scaled]scale2ref=w=trunc(main_w*0.20/2)*2:h=-2[wm][vid]')
      filters.push(`[vid][wm]overlay=${overlayExpr}[out]`)
    } else {
      filters.push('[scaled]null[out]')
    }

    cmd.complexFilter(filters, 'out')

    // Bước 3: Video codec
    cmd.outputOptions(['-c:v libx264', '-preset fast', '-pix_fmt yuv420p', '-movflags +faststart'])
    if (video) {
      cmd.outputOptions([`-b:v ${video}`, `-maxrate ${video}`, `-bufsize ${video}`])
    }

    // Bước 4: Audio — PHẢI map thủ công vì complexFilter không tự giữ audio
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
  })
}

module.exports = { processVideo }