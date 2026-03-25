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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});