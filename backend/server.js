require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Import New Modular Routes ---
const transcribeRoutes = require('./routes/transcribeRoutes');

// --- Import Models ---
const Session = require('./models/Session');
const User = require('./models/User');
const Speech = require('./models/Speech');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

//  AI Transcribe Route  
app.use('/api/transcribe', transcribeRoutes);

// 1. Auth Routes
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

// 2. Session Routes
app.post('/api/sessions', async (req, res) => {
  try {
    const { userId, overallScore, ...sessionData } = req.body;
    const newSession = new Session({ userId, overallScore, ...sessionData });
    const savedSession = await newSession.save();
    console.log("💾 Session Saved:", savedSession._id);

    // Gamification Logic
    if (userId && userId !== 'Guest') {
      const user = await User.findById(userId);
      if (user) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); 
        
        let lastDate = null;
        if (user.lastPracticeDate) {
            const d = new Date(user.lastPracticeDate);
            lastDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }

        if (!lastDate) {
            user.currentStreak = 1;
        } else {
            const diffTime = Math.abs(today - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                user.currentStreak += 1;
            } else if (diffDays > 1) {
                user.currentStreak = 1;
            }
        }
        
        user.lastPracticeDate = now;
        const xpEarned = 50 + Math.round((overallScore || 0) / 2);
        user.xp = (user.xp || 0) + xpEarned;

        if (user.xp < 500) user.rank = "Novice Speaker";
        else if (user.xp < 2000) user.rank = "Intermediate Speaker";
        else if (user.xp < 5000) user.rank = "Professional Speaker";
        else user.rank = "Public Speaking Master";

        await user.save();
      }
    }
    res.status(201).json(savedSession);
  } catch (err) {
    console.error("Error saving session:", err);
    res.status(500).json({ error: "Failed to save session" });
  }
});

app.get('/api/sessions/top-rated', async (req, res) => {
  try {
    const { mode, speechTitle, excludeId } = req.query;
    const query = {
      isPublic: true,            
      practiceMode: mode,        
      overallScore: { $gt: 80 } 
    };

    if (speechTitle && speechTitle !== "Free Practice") {
       query.speechTitle = speechTitle;
    }
    if (excludeId) {
        query._id = { $ne: excludeId };
    }

    const topSessions = await Session.find(query).sort({ overallScore: -1 }).limit(3); 
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
        return { ...session.toObject(), userName };
    }));
    res.json(resultsWithNames);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch top sessions" });
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

app.patch('/api/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const result = await Session.findByIdAndUpdate(id, updates, { new: true });
        if (!result) return res.status(404).json({ error: "Session not found" });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Failed to update session" });
    }
});

app.delete('/api/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Session.findByIdAndDelete(id);
        res.json({ message: "Session deleted from DB" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete" });
    }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 3. Speech Routes
app.post('/api/speeches', async (req, res) => {
  try {
    const newSpeech = new Speech(req.body);
    const savedSpeech = await newSpeech.save();
    res.status(201).json(savedSpeech);
  } catch (err) {
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
    res.status(500).json({ error: "Failed to fetch speeches" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});