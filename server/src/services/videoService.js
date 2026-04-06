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
 * Chiến lược: veryfast + CRF cao = encode nhanh + file nhỏ
 *
 * CRF (Constant Rate Factor):
 *   0  = lossless (to nhất)
 *   18 = gần lossless, chất lượng rất cao
 *   23 = default libx264
 *   28 = chấp nhận được, file nhỏ rõ
 *   32 = chất lượng thấp, file rất nhỏ
 *   51 = tệ nhất
 *
 * Mỗi +6 CRF ≈ file nhỏ hơn ~50%
 * Mỗi +3 CRF ≈ file nhỏ hơn ~25-30%
 *
 * preset veryfast vs ultrafast:
 *   - ultrafast: encode cực nhanh, nén kém nhất → file TO
 *   - veryfast : chậm hơn ~15-20%, nhưng nén tốt hơn ~25-30% → ✅ sweet spot
 */
const PRESETS = {
  'Original': { crf: 23, scale: null },  // nén vừa, giữ resolution gốc
  '4K':       { crf: 24, scale: 3840 },  // 4K — file nhỏ hơn ~40% so với cũ
  '1080p':    { crf: 26, scale: 1920 },  // FHD — file nhỏ hơn ~50% so với cũ
  '720p':     { crf: 28, scale: 1280 },  // HD  — file nhỏ hơn ~55% so với cũ
  '480p':     { crf: 30, scale: 854  },  // SD  — file nhỏ hơn ~60% so với cũ
  '360p':     { crf: 32, scale: 640  },  // Low — file rất nhỏ
  '240p':     { crf: 34, scale: 426  },  // Tiny— file cực nhỏ
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
  'Original': '128k',  // hạ từ 192k → 128k: tai người không phân biệt được ở web
  '4K':       '128k',
  '1080p':    '128k',
  '720p':     '96k',
  '480p':     '80k',
  '360p':     '64k',
  '240p':     '48k',
}

// Padding động: 2% cạnh lớn nhất — dùng FFmpeg expression if(gt(W,H),W,H)*0.02
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

// ✅ Đổi tên + lấy thêm duration và sourceBitrate
function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const stream = metadata.streams.find(s => s.codec_type === 'video')
      if (!stream) return reject(new Error('Không tìm thấy video stream'))
      resolve({
        width:         stream.width,
        height:        stream.height,
        duration:      parseFloat(metadata.format.duration) || 0,
        sourceBitrate: parseInt(stream.bit_rate || metadata.format.bit_rate || 0),
      })
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
      const wm             = wmPath || DEFAULT_WATERMARK
      const hasWm          = fs.existsSync(wm)
      const { crf, scale } = PRESETS[preset] ?? PRESETS['720p']
      const audioBitrate   = AUDIO_BITRATE[preset] ?? '96k'
      const overlayExpr    = OVERLAY_POSITIONS[wmPosition] || OVERLAY_POSITIONS['bottom-left']

      const allowedBitrates = BITRATE_OPTIONS[preset] ?? ['auto']
      const rawBitrate      = allowedBitrates.includes(videoBitrate) ? videoBitrate : 'auto'

      // ✅ Lấy thêm duration và sourceBitrate (dùng chung cho logoW + cap bitrate)
      const { width: origW, height: origH, sourceBitrate } = await getVideoInfo(inputPath)

      // ✅ Cap bitrate — không cho output vượt bitrate gốc, tránh inflate file
      // Ví dụ: chọn 40000k nhưng gốc chỉ 5000k → cap về 5000k
      let finalBitrate = rawBitrate
      if (rawBitrate !== 'auto' && sourceBitrate > 0) {
        const requestedBps = parseInt(rawBitrate) * 1000
        if (requestedBps > sourceBitrate) {
          const cappedKbps = Math.floor(sourceBitrate / 1000 / 100) * 100
          finalBitrate     = `${cappedKbps}k`
          console.log(`[bitrate cap] ${rawBitrate} > source ${Math.round(sourceBitrate/1000)}k → capped to ${finalBitrate}`)
        }
      }

      let logoW = null
      if (hasWm) {
        const finalVideoW = (scale !== null && origW > scale) ? scale : origW
        const finalVideoH = (scale !== null && origW > scale)
          ? Math.round(origH * scale / origW)
          : origH
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
        '-preset veryfast',
        '-profile:v main',
        '-level:v 4.0',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-threads 0',
      ]

      if (finalBitrate === 'auto') {
        // CRF mode — bitrate tự động theo nội dung
        videoOptions.push(`-crf ${crf}`)
      } else {
        // ✅ VBR có trần: CRF giữ chất lượng, maxrate giới hạn trên
        // KHÔNG dùng -b:v CBR vì sẽ inflate file nếu target > bitrate gốc
        videoOptions.push(`-crf ${crf}`)
        videoOptions.push(`-maxrate ${finalBitrate}`)
        videoOptions.push(`-bufsize ${parseInt(finalBitrate) * 2}k`.replace('kk', 'k'))
      }

      cmd.outputOptions(videoOptions)

      // Bước 4: Audio — AAC, stereo mix down nếu > 2ch để tránh lỗi surround
      cmd.outputOptions([
        '-map 0:a?',
        '-c:a aac',
        `-b:a ${audioBitrate}`,
        '-ac 2',   // downmix về stereo — tránh lỗi 5.1 surround trên web
      ])

      console.log(
        `[FFmpeg] preset=${preset} | encode=veryfast | crf=${crf} | bitrate=${finalBitrate} | ` +
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