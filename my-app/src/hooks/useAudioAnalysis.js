import { useState, useRef, useEffect } from 'react';

export const useAudioAnalysis = () => {
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const [volumeLevel, setVolumeLevel] = useState(0);

    const setupAudio = (stream) => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            
            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
        } catch (err) {
            console.error("Audio setup error:", err);
        }
    };

    const analyzeVolume = () => {
        if (!analyserRef.current || !dataArrayRef.current) return { vol: 0 };
        
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const avg = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length;
        
        const NOISE_FLOOR = 10; 
        let rawVolume = avg > NOISE_FLOOR ? (avg - NOISE_FLOOR) * 2.0 : 0;
        let volume = Math.min(100, Math.round(rawVolume));
        
        setVolumeLevel(volume);
        return { vol: volume };
    };

    // ניקוי אוטומטי ביציאה
    useEffect(() => {
        return () => {
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    return { 
        volumeLevel, 
        setupAudio, 
        analyzeVolume,
        // מחזירים את הרפים למקרה חירום, אבל הרוב מטופל בפנים
        audioContextRef,
        analyserRef
    };
};