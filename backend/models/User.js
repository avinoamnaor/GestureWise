const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // --- שדות חדשים לגיימיפיקציה ---
  xp: { type: Number, default: 0 }, // נקודות ניסיון
  rank: { type: String, default: "Novice Speaker" }, // הדרגה הנוכחית
  currentStreak: { type: Number, default: 0 }, // רצף ימים
  lastPracticeDate: { type: Date, default: null }, // תאריך אימון אחרון
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);