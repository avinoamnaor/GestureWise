require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@deepgram/sdk');
const fs = require('fs');

const Session = require('./models/Session');
const User = require('./models/User');
const Speech = require('./models/Speech');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(deepgramApiKey);

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ===========================
// Routes
// ===========================

app.post('/api/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ fullName, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User created successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Error registering user" });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, name: user.fullName }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user._id, name: user.fullName, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Error logging in" });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const newSession = new Session(req.body);
    const savedSession = await newSession.save();
    console.log("💾 Session Saved:", savedSession._id);
    res.status(201).json(savedSession);
  } catch (err) {
    console.error("Error saving session:", err);
    res.status(500).json({ error: "Failed to save session" });
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId ? { userId } : {};
    const sessions = await Session.find(filter).sort({ date: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Session.findByIdAndDelete(id);
        console.log("🗑️ Session deleted from DB:", id);
        res.json({ message: "Session deleted from DB" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete" });
    }
});

app.post('/api/speeches', async (req, res) => {
  try {
    const newSpeech = new Speech(req.body);
    const savedSpeech = await newSpeech.save();
    console.log("📝 Speech Saved:", savedSpeech.title, "| Public:", savedSpeech.isPublic);
    res.status(201).json(savedSpeech);
  } catch (err) {
    console.error("Error saving speech:", err);
    res.status(500).json({ error: "Failed to save speech" });
  }
});

app.get('/api/speeches', async (req, res) => {
  try {
    const { userId } = req.query;
    let query = { isPublic: true }; 
    if (userId) {
        query = { $or: [ { isPublic: true }, { userId: userId } ] };
    }
    const speeches = await Speech.find(query).sort({ date: -1 });
    res.json(speeches);
  } catch (err) {
    console.error("Error fetching speeches:", err);
    res.status(500).json({ error: "Failed to fetch speeches" });
  }
});

// ===========================
// 4. ניתוח דיבור (STT) - הגרסה הסופית והמלוטשת 🎙️
// ===========================

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
             return res.status(400).json({ error: "No audio file provided" });
        }

        console.log(`🎤 Analyzing audio file: ${req.file.path}`);

        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            fs.createReadStream(req.file.path),
            {
                model: "nova-2",       
                smart_format: false,   // משאיר את הגמגומים בטקסט
                punctuate: true,       
                filler_words: true,    
                language: "en",
            }
        );

        if (error) throw error;

        fs.unlinkSync(req.file.path);

        const transcript = result.results.channels[0].alternatives[0].transcript;
        const words = result.results.channels[0].alternatives[0].words;
        const durationMin = result.metadata.duration / 60;
        const wpm = words.length / durationMin;

        console.log("Raw words found:", words.map(w => w.word).join(" "));

        // === אלגוריתם ספירה ממוקד וסופי ===
        let fillersCount = 0;
        
        // רשימת צלילים בלבד (בלי מילים שיכולות להיות תקינות כמו like/so)
        const suspiciousList = [
            "um", "umm", "uh", "uhh", 
            "ah", "ahh", "er", "err", 
            "eh", "ehh", "ehm", "em", 
            "hm", "hmm", "mhm", "mm", 
            "huh", "erm", "ahem", "sooo" // (רק so ארוך)
        ];

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const cleanWord = w.word.toLowerCase().replace(/[^a-z]/g, ''); 
            
            // 1. Deepgram זיהה לבד
            if (w.filled_pause === true) {
                fillersCount++;
                continue;
            }

            // 2. זיהוי לפי הרשימה שלנו
            if (suspiciousList.includes(cleanWord)) {
                fillersCount++;
                continue;
            }
            
            // 3. זיהוי חזרות (Stuttering) - "and and", "to to"
            if (i > 0) {
                const prevWord = words[i-1].word.toLowerCase().replace(/[^a-z]/g, '');
                // בודקים שהמילה זהה לקודמת, ושהיא ארוכה מאות אחת (למנוע טעויות זיהוי של 'a a')
                if (cleanWord === prevWord && cleanWord.length > 1) { 
                    console.log(`Found repetition filler: "${prevWord}" -> "${cleanWord}"`);
                    fillersCount++;
                }
            }
        }

        console.log("✅ Transcription done! WPM:", wpm.toFixed(0), "Fillers Found:", fillersCount);

        res.json({
            transcript: transcript,
            wpm: wpm.toFixed(0),
            fillerCount: fillersCount,
            words: words 
        });

    } catch (err) {
        console.error("❌ Transcription Error:", err);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); 
        res.status(500).json({ error: "Transcription failed", details: err.message });
    }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});