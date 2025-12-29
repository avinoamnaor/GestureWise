require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ייבוא המודלים (כולל החדש)
const Session = require('./models/Session');
const User = require('./models/User');
const Speech = require('./models/Speech'); // <--- המודל החדש לנאומים

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

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
// 2. אימונים (Sessions)
// ===========================

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

// מחיקת אימון (פשוטה - מוחקת רק מהדאטה בייס, לא מ-Cloudinary)
app.delete('/api/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Session.findByIdAndDelete(id); // מחיקה מהירה מה-DB
        console.log("🗑️ Session deleted from DB:", id);
        res.json({ message: "Session deleted from DB" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete" });
    }
});


// ===========================
// 3. נאומים (Speeches) - החדש! 🎤
// ===========================

// שמירת נאום חדש
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

// שליפת נאומים (לוגיקה חכמה: ציבוריים + פרטיים שלי)
app.get('/api/speeches', async (req, res) => {
  try {
    const { userId } = req.query; // נקבל את ה-ID של המשתמש

    // ברירת מחדל: תביא רק ציבוריים
    let query = { isPublic: true }; 

    if (userId) {
        // אם יש משתמש, תביא או ציבוריים או פרטיים *שלו*
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});