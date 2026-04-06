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

/**
 * scale   : giới hạn chiều rộng tối đa (null = giữ nguyên)
 * crf     : dùng khi videoBitrate = 'auto' — chất lượng cố định
 * Khi videoBitrate là chuỗi số (vd '8000k') → dùng -b:v thay CRF
 */
const PRESETS = {
  'Original': { crf: 18, scale: null },
  '4K':       { crf: 18, scale: 3840 },
  '1080p':    { crf: 20, scale: 1920 },
  '720p':     { crf: 22, scale: 1280 },
  '480p':     { crf: 24, scale: 854  },
  '360p':     { crf: 26, scale: 640  },
  '240p':     { crf: 28, scale: 426  },
}

const BITRATE_OPTIONS = {
  'Original': ['auto'],
  '4K':       ['auto', '40000k', '20000k', '10000k'],
  '1080p':    ['auto', '12000k', '8000k',  '4000k' ],
  '720p':     ['auto', '6000k',  '4000k',  '2000k' ],
  '480p':     ['auto', '3000k',  '2000k',  '1000k' ],
  '360p':     ['auto', '1500k',  '1000k',  '600k'  ],
  '240p':     ['auto', '700k',   '500k',   '300k'  ],
}

const AUDIO_BITRATE = {
  'Original': '192k',
  '4K':       '192k',
  '1080p':    '192k',
  '720p':     '128k',
  '480p':     '96k',
  '360p':     '64k',
  '240p':     '48k',
}

// ✅ Padding động: 2% cạnh lớn nhất — dùng FFmpeg expression if(gt(W,H),W,H)*0.02
const OVERLAY_POSITIONS = {
  'top-left':      'x=if(gt(W\\,H)\\,W\\,H)*0.02:y=if(gt(W\\,H)\\,W\\,H)*0.02',
  'top-center':    'x=(W-w)/2:y=if(gt(W\\,H)\\,W\\,H)*0.02',
  'top-right':     'x=W-w-if(gt(W\\,H)\\,W\\,H)*0.02:y=if(gt(W\\,H)\\,W\\,H)*0.02',
  'center-left':   'x=if(gt(W\\,H)\\,W\\,H)*0.02:y=(H-h)/2',
  'center':        'x=(W-w)/2:y=(H-h)/2',
  'center-right':  'x=W-w-if(gt(W\\,H)\\,W\\,H)*0.02:y=(H-h)/2',
  'bottom-left':   'x=if(gt(W\\,H)\\,W\\,H)*0.02:y=H-h-if(gt(W\\,H)\\,W\\,H)*0.02',
  'bottom-center': 'x=(W-w)/2:y=H-h-if(gt(W\\,H)\\,W\\,H)*0.02',
  'bottom-right':  'x=W-w-if(gt(W\\,H)\\,W\\,H)*0.02:y=H-h-if(gt(W\\,H)\\,W\\,H)*0.02',
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

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string} preset        - 'Original'|'4K'|'1080p'|'720p'|'480p'|'360p'|'240p'
 * @param {string|null} wmPath
 * @param {string} wmPosition
 * @param {string} videoBitrate  - 'auto' | '40000k' | '8000k' | ...
 */
const processVideo = async (
  inputPath,
  outputPath,
  preset        = '720p',
  wmPath        = null,
  wmPosition    = 'bottom-left',
  videoBitrate  = 'auto',
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const wm           = wmPath || DEFAULT_WATERMARK
      const hasWm        = fs.existsSync(wm)
      const { crf, scale } = PRESETS[preset] ?? PRESETS['720p']
      const audioBitrate = AUDIO_BITRATE[preset] ?? '128k'
      const overlayExpr  = OVERLAY_POSITIONS[wmPosition] || OVERLAY_POSITIONS['bottom-left']

      const allowedBitrates = BITRATE_OPTIONS[preset] ?? ['auto']
      const finalBitrate    = allowedBitrates.includes(videoBitrate) ? videoBitrate : 'auto'

      let logoW = null
      if (hasWm) {
        // ✅ Lấy cả width lẫn height để tính cạnh lớn nhất
        const { width: origW, height: origH } = await getVideoSize(inputPath)

        // Tính kích thước thực tế sau khi scale (giữ tỉ lệ)
        const finalVideoW = (scale !== null && origW > scale) ? scale : origW
        const finalVideoH = (scale !== null && origW > scale)
          ? Math.round(origH * scale / origW)
          : origH

        // ✅ Dùng cạnh lớn nhất — logo đúng kích thước cho cả video ngang lẫn dọc
        const maxDim = Math.max(finalVideoW, finalVideoH)
        logoW = Math.max(2, Math.floor(maxDim * 0.22 / 2) * 2)
      }

      const cmd     = ffmpeg(inputPath)
      const filters = []

      // Bước 1: Scale video (giữ tỉ lệ, không phóng to)
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

      // Bước 3: Video codec
      const videoOptions = [
        '-c:v libx264',
        '-preset ultrafast',
        '-tune fastdecode',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-threads 0',
      ]

      if (finalBitrate === 'auto') {
        videoOptions.push(`-crf ${crf}`)
      } else {
        videoOptions.push(`-b:v ${finalBitrate}`)
        videoOptions.push(`-maxrate ${finalBitrate}`)
        videoOptions.push(`-bufsize ${parseInt(finalBitrate) * 2}k`.replace('kk', 'k'))
      }

      cmd.outputOptions(videoOptions)

      // Bước 4: Audio
      cmd.outputOptions(['-map 0:a?', '-c:a aac', `-b:a ${audioBitrate}`])

      console.log(
        `[FFmpeg] preset=${preset} | bitrate=${finalBitrate} | ` +
        `crf=${finalBitrate === 'auto' ? crf : 'n/a'} | ` +
        `scale=${scale ?? 'original'} | audio=${audioBitrate}`
      )

      cmd
        .output(outputPath)
        .on('start', c  => console.log('[FFmpeg] start:', c.slice(0, 120) + '...'))
        .on('progress', p => p.percent && process.stdout.write(`\r[FFmpeg] ${p.percent.toFixed(1)}%`))
        .on('end', () => {
          console.log(`\n[FFmpeg] done → ${outputPath}`)
          resolve({ processedSize: fs.statSync(outputPath).size, preset, videoBitrate: finalBitrate })
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

module.exports = { processVideo, BITRATE_OPTIONS }