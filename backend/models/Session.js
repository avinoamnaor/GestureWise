const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  speechType: { type: String, default: "Free Practice" },
  date: { type: Date, default: Date.now },
  duration: { type: String },
  overallScore: { type: Number },
  
  // הוספנו את הוידאו (זה כבר היה לך)
  videoUrl: { type: String },

  // === הנה החלק שחסר לך! (הוסף את זה) ===
  transcript: { type: String },  // איפה שנשמור את הטקסט
  wpm: { type: Number },         // מילים לדקה
  fillerCount: { type: Number }, // ספירת "אממ"
  // ======================================

  metrics: {
    eyeContact: Number,
    expression: Number,
    centering: Number,
    hands: Number,
    volume: Number,
    articulation: Number,
    posture: Number
  }
});

module.exports = mongoose.model('Session', sessionSchema);