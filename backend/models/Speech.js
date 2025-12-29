const mongoose = require('mongoose');

const speechSchema = new mongoose.Schema({
  userId: { type: String, required: true },       // ה-ID של המשתמש שיצר
  authorName: { type: String, default: "Anonymous" }, // השם שיוצג בכרטיסייה
  title: { type: String, required: true },
  text: { type: String, required: true },
  isPublic: { type: Boolean, default: false },    // false = פרטי, true = לכולם
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Speech', speechSchema);