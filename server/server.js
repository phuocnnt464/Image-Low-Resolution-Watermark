require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const bodyParser = require('body-parser');
const imageRoutes = require('./src/routes/imageRoutes');
const videoRoutes = require('./src/routes/videoRoutes');

const port = process.env.PORT || 3000;
const app  = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Routes
app.use('/api/images', imageRoutes);
app.use('/api/videos', videoRoutes);

app.get('/health', (req, res) => {
  const watermarkPath = process.env.WATERMARK_PATH
    || path.join(__dirname, 'assets/watermark.png');

  res.json({
    status:    'ok',
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      server:    true,
      watermark: fs.existsSync(watermarkPath),
      uploadDir: fs.existsSync(process.env.UPLOAD_DIR || path.join(__dirname, 'public/uploads')),
    },
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `${req.originalUrl} not found` });
});

// Global error handler
const multer = require('multer');
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File vượt quá dung lượng cho phép' });
    return res.status(400).json({ message: err.message });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Payload quá lớn' });
  
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal Server Error',
    error: err.stack
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});