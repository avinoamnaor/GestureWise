const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  
  // זיהוי הנאום (חשוב ל"היכל התהילה")
  speechTitle: { type: String, default: "Free Practice" }, 
  practiceMode: { type: String, enum: ['sitting', 'standing'], default: 'sitting' },
  
  // פרטיות (ברירת מחדל: פרטי)
  isPublic: { type: Boolean, default: false },

  date: { type: Date, default: Date.now },
  duration: { type: String },
  overallScore: { type: Number },
  videoUrl: { type: String },

  // נתונים טקסטואליים
  transcript: { type: String },
  wpm: { type: Number },
  fillerCount: { type: Number },
  repetitiveWords: { type: Array }, // הוספנו כדי שזה יישמר בבסיס הנתונים

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