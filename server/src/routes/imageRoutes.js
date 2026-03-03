const express = require('express');
const router  = express.Router();
const { uploadFields } = require('../middleware/uploadMiddleware');
const {
  processImages,
  getHistory,
  getHistoryById,
  deleteHistory,
} = require('../controllers/imageController');

router.post('/process',       uploadFields, processImages);
router.get('/history',        getHistory);
router.get('/history/:id',    getHistoryById);
router.delete('/history/:id', deleteHistory);

module.exports = router;