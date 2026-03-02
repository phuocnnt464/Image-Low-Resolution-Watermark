const express = require('express');
const router  = express.Router();
const upload  = require('../middlewares/uploadMiddleware');
const {
  processImages,
  getHistory,
  getHistoryById,
  deleteHistory,
} = require('../controllers/imageController');

router.post('/process',          upload.array('images', 20), processImages);
router.get('/history',           getHistory);
router.get('/history/:id',       getHistoryById);
router.delete('/history/:id',    deleteHistory);

module.exports = router;