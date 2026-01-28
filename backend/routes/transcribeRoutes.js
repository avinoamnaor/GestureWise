const express = require('express');
const router = express.Router();
const multer = require('multer');
const transcribeController = require('../controllers/transcribeController');

// Setup file upload
const upload = multer({ dest: 'uploads/' });

// Route: POST /api/transcribe
router.post('/', upload.single('file'), transcribeController.transcribeAudio);

module.exports = router;