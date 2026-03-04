require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const bodyParser = require('body-parser');
const initDB     = require('./src/config/initDB');
const imageRoutes = require('./src/routes/imageRoutes');

const port = process.env.PORT || 3000;
const app  = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve file tĩnh từ thư mục assets (để client load watermark mặc định cho canvas preview)
app.use('/assets', express.static(path.resolve(__dirname, 'assets')));

// Routes
app.use('/api/images', imageRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `${req.originalUrl} not found` });
});

// Khởi động server sau khi init DB xong
initDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('❌ Cannot start server:', err);
    process.exit(1);
  });