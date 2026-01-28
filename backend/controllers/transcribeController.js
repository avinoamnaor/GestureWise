const analysisService = require('../services/analysisService');
const fs = require('fs');

exports.transcribeAudio = async (req, res) => {
    try {
        if (!req.file) {
             return res.status(400).json({ error: "No audio file provided" });
        }

        console.log(`🎤 Analyzing audio file: ${req.file.path}`);

        // Call the intelligent analysis service
        const results = await analysisService.analyzeAudio(req.file.path);

        // Cleanup: Delete temp file
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        console.log("✅ Analysis complete! WPM:", results.wpm);
        res.json(results);

    } catch (err) {
        console.error("❌ Error:", err);
        // Cleanup on error
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); 
        res.status(500).json({ error: "Analysis failed", details: err.message });
    }
};