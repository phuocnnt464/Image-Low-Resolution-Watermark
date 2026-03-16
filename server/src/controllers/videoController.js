const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');
const { processVideo } = require('../services/videoService');
require('dotenv').config();

const UPLOAD_DIR        = process.env.UPLOAD_DIR    || path.resolve(__dirname, '../../public/uploads');
const DEFAULT_WATERMARK = process.env.WATERMARK_PATH || path.resolve(__dirname, '../../assets/watermark.png');

const VALID_PRESETS = ['Original', '4K', '1080p', '720p', '480p', '360p', '240p'];

const cleanupFiles = (paths) => {
  paths.forEach((p) => {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  });
};

// ─── POST /api/videos/process ─────────────────────────────────────────────────
const processVideoHandler = async (req, res) => {
  const videoFiles     = req.files?.['video']     || [];
  const watermarkFiles = req.files?.['watermark'] || [];

  if (videoFiles.length === 0) {
    return res.status(400).json({ message: 'Không có video nào được upload' });
  }

  const rawPreset      = req.body.bitratePreset || '720p';
  const bitratePreset  = VALID_PRESETS.includes(rawPreset) ? rawPreset : '720p';
  const watermarkPosition = req.body.watermarkPosition || 'bottom-left';

  const videoFile = videoFiles[0];
  const inputPath = videoFile.path;

  const hasCustomWatermark = watermarkFiles.length > 0;
  const watermarkPath = hasCustomWatermark ? watermarkFiles[0].path : DEFAULT_WATERMARK;

  // Output luôn là .mp4
  const id         = uuidv4();
  const outputName = `processed-video-${id}.mp4`;
  const outputPath = path.join(UPLOAD_DIR, outputName);

  console.log(`[video] preset=${bitratePreset} | position=${watermarkPosition}`);

  try {
    const result = await processVideo(
      inputPath,
      outputPath,
      bitratePreset,
      watermarkPath,
      watermarkPosition
    );

    const downloadName = `watermarked-${path.parse(videoFile.originalname).name}.mp4`;

    res.download(outputPath, downloadName, (err) => {
      cleanupFiles([
        inputPath,
        outputPath,
        ...(hasCustomWatermark ? [watermarkFiles[0].path] : []),
      ]);
      if (err) console.error('Video download error:', err);
    });

  } catch (err) {
    console.error('processVideo error:', err);
    cleanupFiles([inputPath, outputPath, ...(hasCustomWatermark ? [watermarkFiles[0].path] : [])]);
    res.status(500).json({ message: 'Lỗi xử lý video', error: err.message });
  }
};

module.exports = { processVideoHandler };