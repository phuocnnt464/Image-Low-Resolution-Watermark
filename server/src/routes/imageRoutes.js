const express = require('express');
const upload = require('../config/multer');
const ImageController = require('../controllers/imageController');

const router = express.Router();

// Image routes
router.post('/upload', upload.single('image'), ImageController.upload);
router.get('/', ImageController.getAll);
router.get('/stats', ImageController.getStats);
router.get('/:id', ImageController.getById);
router.delete('/:id', ImageController.delete);
router.post('/:id/add-text-watermark', ImageController.addTextWatermark);

module.exports = router;