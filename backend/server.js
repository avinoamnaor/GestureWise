require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@deepgram/sdk');
const fs = require('fs');

// ייבוא המודלים
const Session = require('./models/Session');
const User = require('./models/User');
const Speech = require('./models/Speech');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

// הגדרת המפתח של Deepgram
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(deepgramApiKey);

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// חיבור ל-MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));


// ===========================
// 1. משתמשים (Auth)
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


// ===========================
// 2. אימונים (Sessions) - יצירה, שליפה, מחיקה ועדכון
// ===========================

// שמירת אימון חדש
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

// שליפת "היכל התהילה" (המצטיינים) - חייב להופיע לפני השליפה הכללית
app.get('/api/sessions/top-rated', async (req, res) => {
  try {
    // הוספנו את excludeId לרשימת הפרמטרים
    const { mode, speechTitle, excludeId } = req.query;

    const query = {
      isPublic: true,            
      practiceMode: mode,        
      overallScore: { $gt: 40 } 
    };

    if (speechTitle && speechTitle !== "Free Practice") {
       query.speechTitle = speechTitle;
    }

    // === השינוי: אם התקבל ID להחרגה, לא מחזירים אותו ===
    if (excludeId) {
        query._id = { $ne: excludeId }; // $ne = Not Equal
    }
    // =================================================

    const topSessions = await Session.find(query)
      .sort({ overallScore: -1 }) 
      .limit(3); 

    const resultsWithNames = await Promise.all(topSessions.map(async (session) => {
        let userName = "Anonymous Speaker";
        if (session.userId) {
            try {
                const user = await User.findById(session.userId);
                if (user) userName = user.fullName;
            } catch (e) {
                console.log("Error finding user name", e);
            }
        }
        
        return {
            ...session.toObject(),
            userName
        };
    }));

    res.json(resultsWithNames);

  } catch (err) {
    console.error("Error fetching top sessions:", err);
    res.status(500).json({ error: "Failed to fetch top sessions" });
  }
});

// שליפת כל האימונים (למשתמש ספציפי)
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

// עדכון אימון (למשל: שינוי ל-Public) - הראוט החדש!
app.patch('/api/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // למשל { isPublic: true }
        
        const result = await Session.findByIdAndUpdate(id, updates, { new: true });
        
        if (!result) {
            return res.status(404).json({ error: "Session not found" });
        }
        
        console.log(`📝 Session ${id} updated:`, updates);
        res.json(result);
    } catch (error) {
        console.error("Error updating session:", error);
        res.status(500).json({ error: "Failed to update session" });
    }
});

// מחיקת אימון
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


// ===========================
// 3. נאומים (Speeches)
// ===========================

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
        query = {
            $or: [
                { isPublic: true },
                { userId: userId }
            ]
        };
    }

    const speeches = await Speech.find(query).sort({ date: -1 });
    res.json(speeches);
  } catch (err) {
    console.error("Error fetching speeches:", err);
    res.status(500).json({ error: "Failed to fetch speeches" });
  }
});


// ===========================
// 4. ניתוח דיבור (STT) - הגרסה האגרסיבית והמלאה
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

        // מחיקת הקובץ הזמני
        fs.unlinkSync(req.file.path);

        const transcript = result.results.channels[0].alternatives[0].transcript;
        const words = result.results.channels[0].alternatives[0].words;
        const durationMin = result.metadata.duration / 60;
        const wpm = words.length / durationMin;
        const totalWordCount = words.length;

        console.log("Raw words found:", words.map(w => w.word).join(" "));

        // === אלגוריתם ספירה אגרסיבי ===
        let fillersCount = 0;
        
        // רשימה מורחבת של חשודים
        const suspiciousList = [
            "um", "umm", "uh", "uhh", "ah", "ahh", "er", "err", "eh", "ehh", 
            "hm", "hmm", "mhm", "mm", "huh", "erm", "ahem", "sooo", "aa", "ee", 
            "am", "im", "an"
        ];

        // Regex שתופס מילים כמו "aaaaa" או "mmmmm"
        const vocalizationRegex = /^(.)\1{2,}$/; 

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const cleanWord = w.word.toLowerCase().replace(/[^a-z]/g, ''); 
            
            // 1. זיהוי מובנה של Deepgram
            if (w.filled_pause === true) { 
                fillersCount++; 
                continue; 
            }

            // 2. זיהוי לפי רשימה שלנו
            if (suspiciousList.includes(cleanWord)) { 
                fillersCount++; 
                continue; 
            }

            // 3. זיהוי מריחות קול (Regex חדש!)
            if (vocalizationRegex.test(cleanWord)) { 
                console.log(`Found vocalization filler: "${cleanWord}"`);
                fillersCount++; 
                continue; 
            }
            
            // 4. זיהוי חזרות (Stuttering)
            if (i > 0) {
                const prevWord = words[i-1].word.toLowerCase().replace(/[^a-z]/g, '');
                if (cleanWord === prevWord) { 
                    console.log(`Found repetition filler: "${prevWord}" -> "${cleanWord}"`);
                    fillersCount++;
                }
            }
        }

        // === אלגוריתם זיהוי מילים נתקעות (לפי אחוזים) ===
        const stopWords = new Set([
            "a", "an", "the", "and", "but", "or", "if", "of", "to", "in", "on", "that", "it", 
            "is", "was", "for", "with", "as", "at", "be", "this", "have", "from", "one", "had", 
            "by", "not", "all", "we", "when", "your", "can", "said", "there", "use", "each", 
            "which", "she", "do", "how", "their", "will", "up", "other", "about", "out", "many", 
            "then", "them", "these", "so", "some", "her", "would", "make", "like", "him", "into", 
            "time", "has", "look", "two", "more", "write", "go", "see", "number", "no", "way", 
            "could", "people", "my", "than", "first", "been", "call", "who", "its", "now", "find", 
            "i", "you", "he", "me", "us", "they", "just", "very", "are"
        ]);

        const wordCounts = {};
        words.forEach(w => {
            const clean = w.word.toLowerCase().replace(/[^a-z]/g, '');
            // סופרים מילה רק אם היא לא מילת קישור ולא פילר
            if (clean.length > 1 && !stopWords.has(clean) && !suspiciousList.includes(clean)) {
                wordCounts[clean] = (wordCounts[clean] || 0) + 1;
            }
        });

        // תנאי סף: לפחות 2% מהנאום וגם לפחות 3 פעמים
        const minPercentage = 0.02; 
        const minAbsolute = 3;      

        const topRepetitive = Object.entries(wordCounts)
            .filter(([word, count]) => {
                const percentage = count / totalWordCount;
                return count >= minAbsolute && percentage >= minPercentage;
            })
            .sort((a, b) => b[1] - a[1]) // מיון מהגדול לקטן
            .slice(0, 5) // 5 המובילים
            .map(([word, count]) => ({ word, count }));

        console.log("✅ Transcription done! WPM:", wpm.toFixed(0), "Fillers Found:", fillersCount, "Top Words:", topRepetitive);

        res.json({
            transcript: transcript,
            wpm: wpm.toFixed(0),
            fillerCount: fillersCount,
            repetitiveWords: topRepetitive,
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