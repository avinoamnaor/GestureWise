const { createClient } = require('@deepgram/sdk');
const fs = require('fs');

// Init Deepgram
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(deepgramApiKey);

exports.analyzeAudio = async (filePath) => {
    // 1. Send file to Deepgram for transcription
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        fs.createReadStream(filePath),
        {
            model: "nova-2",
            smart_format: false, // Keep stutters for analysis
            punctuate: true,
            filler_words: true,
            language: "en",
        }
    );

    if (error) throw error;

    const transcript = result.results.channels[0].alternatives[0].transcript;
    const words = result.results.channels[0].alternatives[0].words;
    const durationMin = result.metadata.duration / 60;
    const wpm = words.length / durationMin;
    const totalWordCount = words.length;

    // 2. Custom Filler Word Counter
    let fillersCount = 0;
    
    // Manual list of filler sounds
    const suspiciousList = [
        "um", "umm", "uh", "uhh", "ah", "ahh", "er", "err", "eh", "ehh", 
        "hm", "hmm", "mhm", "mm", "huh", "erm", "ahem", "sooo", "aa", "ee", 
        "am", "im", "an"
    ];
    
    // Regex to detect word elongation (e.g., "sooo", "whaaat", "ummm")
    const elongationRegex = /([a-z])\1{2,}/;

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const cleanWord = w.word.toLowerCase().replace(/[^a-z]/g, ''); 
        
        // Deepgram detected filler
        if (w.filled_pause === true) { fillersCount++; continue; }
        
        // Match against manual list
        if (suspiciousList.includes(cleanWord)) { fillersCount++; continue; }
        
        // Match elongation (stretched sounds anywhere in the word)
        if (elongationRegex.test(cleanWord)) { fillersCount++; continue; }
        
        // Detect immediate repetitions (stuttering)
        if (i > 0) {
            const prevWord = words[i-1].word.toLowerCase().replace(/[^a-z]/g, '');
            if (cleanWord === prevWord) { fillersCount++; }
        }
    }

    // 3. Repetitive Words Analysis
    // Common words to ignore
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
        // Count only meaningful words
        if (clean.length > 1 && !stopWords.has(clean) && !suspiciousList.includes(clean)) {
            wordCounts[clean] = (wordCounts[clean] || 0) + 1;
        }
    });

    // Filter: words appearing at least 3 times and > 2% of speech
    const topRepetitive = Object.entries(wordCounts)
        .filter(([word, count]) => {
            const percentage = count / totalWordCount;
            return count >= 3 && percentage >= 0.02;
        })
        .sort((a, b) => b[1] - a[1]) // Sort highest to lowest
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }));

    return {
        transcript,
        wpm: wpm.toFixed(0),
        fillerCount: fillersCount,
        repetitiveWords: topRepetitive,
        words
    };
};