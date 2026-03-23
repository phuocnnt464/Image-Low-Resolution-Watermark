const express = require('express')
const router  = express.Router()
const { uploadVideoFields }    = require('../middleware/uploadMiddleware')
const { processVideoHandler }  = require('../controllers/videoController')

router.post('/process', uploadVideoFields, processVideoHandler)

module.exports = router