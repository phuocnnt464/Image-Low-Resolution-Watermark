const ffmpeg      = require('fluent-ffmpeg');
const ffmpegPath  = require('ffmpeg-static');
const fs          = require('fs');
const path        = require('path');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png');

/**
 * Bảng preset bitrate
 * videoBitrate : null = giữ nguyên, string = '8000k', '4000k',...
 * audioBitrate : null = giữ nguyên, string = '192k', '128k',...
 * scale        : null = giữ nguyên kích thước, number = width (height tự scale)
 */
const VIDEO_PRESETS = {
  'Original': { videoBitrate: null,     audioBitrate: null,   scale: null  },
  '4K':       { videoBitrate: '20000k', audioBitrate: '320k', scale: 3840  },
  '1080p':    { videoBitrate: '8000k',  audioBitrate: '192k', scale: 1920  },
  '720p':     { videoBitrate: '4000k',  audioBitrate: '128k', scale: 1280  },
  '480p':     { videoBitrate: '2000k',  audioBitrate: '96k',  scale: 854   },
  '360p':     { videoBitrate: '1000k',  audioBitrate: '64k',  scale: 640   },
  '240p':     { videoBitrate: '500k',   audioBitrate: '48k',  scale: 426   },
}

/**
 * @param {string} inputPath
 * @param {string} outputPath       - phải là .mp4
 * @param {string} bitratePreset    - key trong VIDEO_PRESETS
 * @param {string|null} watermarkPath
 * @param {string} watermarkPosition - top-left | top-center | top-right | center |
 *                                     center-left | center-right |
 *                                     bottom-left | bottom-center | bottom-right
 */
const processVideo = (
  inputPath,
  outputPath,
  bitratePreset    = '720p',
  watermarkPath    = null,
  watermarkPosition = 'bottom-left'
) => {
  return new Promise((resolve, reject) => {
    const wmPath  = watermarkPath || DEFAULT_WATERMARK_PATH;
    const preset  = VIDEO_PRESETS[bitratePreset] ?? VIDEO_PRESETS['720p'];
    const { videoBitrate, audioBitrate, scale } = preset;

    // ── Tính overlay position cho FFmpeg ────────────────────────────────────
    // FFmpeg overlay dùng expression string
    const overlayMap = {
      'top-left':      'x=10:y=10',
      'top-center':    'x=(W-w)/2:y=10',
      'top-right':     'x=W-w-10:y=10',
      'center-left':   'x=10:y=(H-h)/2',
      'center':        'x=(W-w)/2:y=(H-h)/2',
      'center-right':  'x=W-w-10:y=(H-h)/2',
      'bottom-left':   'x=10:y=H-h-10',
      'bottom-center': 'x=(W-w)/2:y=H-h-10',
      'bottom-right':  'x=W-w-10:y=H-h-10',
    }
    const overlayExpr = overlayMap[watermarkPosition] || overlayMap['bottom-left'];

    const hasWatermark = fs.existsSync(wmPath);

    let cmd = ffmpeg(inputPath);

    // ── Xây dựng filtergraph ─────────────────────────────────────────────────
    const filters = [];

    // Scale video (giữ tỉ lệ, chỉ scale nếu preset nhỏ hơn gốc)
    if (scale !== null) {
      // scale=width:height=-2 → tự tính height giữ tỉ lệ, chia hết cho 2
      filters.push(`[0:v]scale='min(${scale},iw)':-2[scaled]`);
    } else {
      filters.push('[0:v]copy[scaled]');
    }

    if (hasWatermark) {
      // Resize watermark = 15% chiều rộng video
      // [1:v] = input watermark
      filters.push('[1:v]scale=iw*0.15:-1[wm]');
      filters.push(`[scaled][wm]overlay=${overlayExpr}[out]`);
      cmd.input(wmPath);
    } else {
      filters.push('[scaled]copy[out]');
    }

    cmd.complexFilter(filters, 'out');

    // ── Output options ───────────────────────────────────────────────────────
    cmd
      .outputOptions([
        '-c:v libx264',         // H.264 codec
        '-preset fast',         // cân bằng tốc độ/chất lượng encode
        '-movflags +faststart', // web-friendly: moov atom ở đầu file
        '-pix_fmt yuv420p',     // tương thích rộng (iOS, Android, browser)
      ]);

    if (videoBitrate) {
      cmd.outputOptions([`-b:v ${videoBitrate}`, `-maxrate ${videoBitrate}`, `-bufsize ${videoBitrate}`]);
    }

    // Audio
    if (audioBitrate) {
      cmd.outputOptions(['-c:a aac', `-b:a ${audioBitrate}`]);
    } else {
      cmd.outputOptions(['-c:a copy']); // giữ nguyên audio nếu Original
    }

    cmd
      .output(outputPath)
      .on('start', (cmdLine) => console.log(`[FFmpeg] start: ${cmdLine.slice(0, 120)}...`))
      .on('progress', (p) => {
        if (p.percent) process.stdout.write(`\r[FFmpeg] ${p.percent.toFixed(1)}%`);
      })
      .on('end', () => {
        console.log(`\n[FFmpeg] done → ${outputPath}`);
        try {
          const stat = fs.statSync(outputPath);
          resolve({
            processedSize: stat.size,
            bitratePreset,
          });
        } catch (e) {
          reject(e);
        }
      })
      .on('error', (err) => {
        console.error('[FFmpeg] error:', err.message);
        reject(err);
      })
      .run();
  });
};

module.exports = { processVideo };