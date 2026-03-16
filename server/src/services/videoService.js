const ffmpeg      = require('fluent-ffmpeg');
const ffmpegPath  = require('ffmpeg-static');
const fs          = require('fs');
const path        = require('path');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const DEFAULT_WATERMARK_PATH = process.env.WATERMARK_PATH
  || path.resolve(__dirname, '../../assets/watermark.png');

const VIDEO_PRESETS = {
  'Original': { videoBitrate: null,     audioBitrate: null,   scale: null  },
  '4K':       { videoBitrate: '20000k', audioBitrate: '320k', scale: 3840  },
  '1080p':    { videoBitrate: '8000k',  audioBitrate: '192k', scale: 1920  },
  '720p':     { videoBitrate: '4000k',  audioBitrate: '128k', scale: 1280  },
  '480p':     { videoBitrate: '2000k',  audioBitrate: '96k',  scale: 854   },
  '360p':     { videoBitrate: '1000k',  audioBitrate: '64k',  scale: 640   },
  '240p':     { videoBitrate: '500k',   audioBitrate: '48k',  scale: 426   },
};

const processVideo = (
  inputPath,
  outputPath,
  bitratePreset     = '720p',
  watermarkPath     = null,
  watermarkPosition = 'bottom-left'
) => {
  return new Promise((resolve, reject) => {
    const wmPath  = watermarkPath || DEFAULT_WATERMARK_PATH;
    const preset  = VIDEO_PRESETS[bitratePreset] ?? VIDEO_PRESETS['720p'];
    const { videoBitrate, audioBitrate, scale } = preset;

    const overlayMap = {
      'top-left':      'x=15:y=15',
      'top-center':    'x=(W-w)/2:y=15',
      'top-right':     'x=W-w-15:y=15',
      'center-left':   'x=15:y=(H-h)/2',
      'center':        'x=(W-w)/2:y=(H-h)/2',
      'center-right':  'x=W-w-15:y=(H-h)/2',
      'bottom-left':   'x=15:y=H-h-15',
      'bottom-center': 'x=(W-w)/2:y=H-h-15',
      'bottom-right':  'x=W-w-15:y=H-h-15',
    };
    const overlayExpr = overlayMap[watermarkPosition] || overlayMap['bottom-left'];

    const hasWatermark = fs.existsSync(wmPath);

    let cmd = ffmpeg(inputPath);

    const filters = [];

    if (scale !== null) {
      // Escape dấu phẩy trong FFmpeg filter expression
      filters.push(`[0:v]scale=w=if(gt(iw\\,${scale})\\,${scale}\\,iw):h=-2[scaled]`);
    } else {
      // Original: dùng 'null' passthrough filter để decode frame (không phải stream copy)
      filters.push('[0:v]null[scaled]');
    }

    if (hasWatermark) {
      // trunc(iw*0.15/2)*2 → width/height chia hết 2, tránh lỗi libx264
      filters.push('[1:v]scale=trunc(iw*0.15/2)*2:-2[wm]');
      filters.push(`[scaled][wm]overlay=${overlayExpr}[out]`);
      cmd.input(wmPath);
    } else {
      // QUAN TRỌNG: dùng 'null' filter, KHÔNG phải 'copy'
      // 'copy' không tồn tại trong filtergraph context → FFmpeg lỗi "Filter copy not found"
      filters.push('[scaled]null[out]');
    }

    cmd.complexFilter(filters, 'out');

    cmd.outputOptions([
      '-c:v libx264',
      '-preset fast',
      '-movflags +faststart',
      '-pix_fmt yuv420p',
    ]);

    if (videoBitrate) {
      cmd.outputOptions([
        `-b:v ${videoBitrate}`,
        `-maxrate ${videoBitrate}`,
        `-bufsize ${videoBitrate}`,
      ]);
    }

    if (audioBitrate) {
      cmd.outputOptions(['-c:a aac', `-b:a ${audioBitrate}`]);
    } else {
      // Original: re-encode audio sang AAC để tương thích container mp4
      cmd.outputOptions(['-c:a aac', '-b:a 192k']);
    }

    cmd
      .output(outputPath)
      .on('start', (cmdLine) => console.log(`[FFmpeg] start: ${cmdLine.slice(0, 140)}...`))
      .on('progress', (p) => {
        if (p.percent) process.stdout.write(`\r[FFmpeg] ${p.percent.toFixed(1)}%`);
      })
      .on('end', () => {
        console.log(`\n[FFmpeg] done → ${outputPath}`);
        try {
          const stat = fs.statSync(outputPath);
          resolve({ processedSize: stat.size, bitratePreset });
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