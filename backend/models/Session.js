const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  speechType: { type: String, default: "Free Practice" },
  date: { type: Date, default: Date.now },
  duration: { type: String },
  overallScore: { type: Number },
  
  // --- המטריקות ---
  metrics: {
    eyeContact: Number,
    expression: Number,
    centering: Number,
    hands: Number,
    volume: Number,
    articulation: Number,
    posture: Number
  },

  // --- הנה החלק החסר! ---
  videoUrl: { type: String } 
});

module.exports = mongoose.model('Session', sessionSchema);