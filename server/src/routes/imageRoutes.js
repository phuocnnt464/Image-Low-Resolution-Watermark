const express = require('express')
const router  = express.Router()
const { uploadFields }  = require('../middleware/uploadMiddleware')
const { processImages } = require('../controllers/imageController')

router.post('/images/process', uploadFields, processImages)

module.exports = router