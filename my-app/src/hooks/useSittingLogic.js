import { useState, useRef, useCallback } from 'react';

const CONFIG = {
    STARTING_SCORE: 100,
    MAX_SCORE: 100,
    PENALTY: { CENTERING: 0.5, EYES: 0.2, POSTURE: 0.1, FACE_TOUCH: 0.1 },
    HEALING_RATE: 0.05, 
    THRESHOLDS: { EYES: 15, CENTERING: 10, POSTURE: 40, HEALING_WAIT: 60 },
    NOTIFICATION_COOLDOWN: 5000 
};

export const useSittingLogic = () => {
    const [score, setScore] = useState(CONFIG.STARTING_SCORE);
    const [feedback, setFeedback] = useState(null);

    const scoreRef = useRef(CONFIG.STARTING_SCORE);
    const healingTimer = useRef(0);
    const lastNotificationTime = useRef(0);

    // --- חדש: סטטיסטיקות לסיכום (צוברות נתונים ברקע) ---
    const statsRef = useRef({
        totalFrames: 0,
        badEyesFrames: 0,
        badHandsFrames: 0,
        badPostureFrames: 0,
        badCenterFrames: 0
    });

    const timers = useRef({ eyes: 0, center: 0, hands: 0 });
    const gazeHistory = useRef([]);

    const calculateVariance = (arr) => {
        if (arr.length === 0) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    };

    const processFrame = useCallback((faceLms, poseLms, blendshapes) => {
        let isPerfectFrame = true;
        let currentProblem = null;
        
        // קידום מונה הפריימים הכללי
        statsRef.current.totalFrames++;

        // 1. מרכוז
        if (faceLms) {
            const nose = faceLms[1];
            if (nose.x < 0.35 || nose.x > 0.65) { 
                timers.current.center++;
                if (timers.current.center > CONFIG.THRESHOLDS.CENTERING) {
                    isPerfectFrame = false;
                    scoreRef.current = Math.max(0, scoreRef.current - CONFIG.PENALTY.CENTERING);
                    statsRef.current.badCenterFrames++; // תיעוד לסטטיסטיקה
                    currentProblem = { msg: "מרכז את עצמך מול המצלמה 🎯", type: "danger" };
                }
            } else {
                timers.current.center = 0;
            }
        }

        // 2. קשר עין
        if (blendshapes && !currentProblem) { 
            const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;
            const gazeX = getScore('eyeLookInLeft') - getScore('eyeLookOutLeft');
            const gazeY = getScore('eyeLookUpLeft') - getScore('eyeLookDownLeft');

            gazeHistory.current.push(gazeX);
            if (gazeHistory.current.length > 30) gazeHistory.current.shift();
            const variance = calculateVariance(gazeHistory.current);
            const isReading = variance > 0.001 && variance < 0.015;

            if ((Math.abs(gazeX) > 0.5 || Math.abs(gazeY) > 0.5) && !isReading) {
                timers.current.eyes++;
                if (timers.current.eyes > CONFIG.THRESHOLDS.EYES) {
                    isPerfectFrame = false;
                    scoreRef.current = Math.max(0, scoreRef.current - CONFIG.PENALTY.EYES);
                    statsRef.current.badEyesFrames++; // תיעוד לסטטיסטיקה
                    currentProblem = { msg: "שמור על קשר עין עם הקהל 👀", type: "warning" };
                }
            } else {
                timers.current.eyes = Math.max(0, timers.current.eyes - 2); 
            }
        }

        // 3. ידיים
        if (poseLms && faceLms && !currentProblem) {
            const wristL = poseLms[15]; const wristR = poseLms[16];
            const nose = faceLms[1];
            const touchThreshold = 0.15;
            
            if ((wristL && Math.abs(wristL.x - nose.x) < touchThreshold && Math.abs(wristL.y - nose.y) < touchThreshold) ||
                (wristR && Math.abs(wristR.x - nose.x) < touchThreshold && Math.abs(wristR.y - nose.y) < touchThreshold)) {
                
                timers.current.hands++;
                if (timers.current.hands > 30) { 
                    isPerfectFrame = false;
                    scoreRef.current = Math.max(0, scoreRef.current - CONFIG.PENALTY.FACE_TOUCH);
                    statsRef.current.badHandsFrames++; // תיעוד לסטטיסטיקה
                    currentProblem = { msg: "הרחק ידיים מהפנים ✋", type: "warning" };
                }
            } else {
                timers.current.hands = 0;
            }
        }

        // ריפוי והתראות
        if (isPerfectFrame) {
            healingTimer.current++;
            if (healingTimer.current > CONFIG.THRESHOLDS.HEALING_WAIT) {
                scoreRef.current = Math.min(CONFIG.MAX_SCORE, scoreRef.current + CONFIG.HEALING_RATE);
            }
        } else {
            healingTimer.current = 0;
        }

        const now = Date.now();
        if (currentProblem && (now - lastNotificationTime.current > CONFIG.NOTIFICATION_COOLDOWN)) {
            setFeedback({ message: currentProblem.msg, type: currentProblem.type });
            lastNotificationTime.current = now;
            setTimeout(() => setFeedback(null), 3000);
        }

        if (Math.abs(scoreRef.current - score) > 0.5) {
            setScore(Math.round(scoreRef.current));
        }

    }, [score]);

    // --- פונקציה לחישוב הציון הסופי לכל קטגוריה ---
    const getFinalMetrics = useCallback(() => {
        const total = Math.max(1, statsRef.current.totalFrames);
        
        // חישוב אחוז הזמן שהיית "בסדר" (100 פחות אחוז הזמן שהיית "לא בסדר")
        const calcScore = (badFrames) => Math.max(0, Math.round(100 - (badFrames / total * 100 * 2))); // הכפלה ב-2 כדי להעניש חזק יותר

        return {
            eyeContact: calcScore(statsRef.current.badEyesFrames),
            hands: calcScore(statsRef.current.badHandsFrames),
            centering: calcScore(statsRef.current.badCenterFrames),
            posture: 100 // כרגע אין לנו לוגיקה ליציבה, אז נשאיר 100
        };
    }, []);

    return { score, feedback, processFrame, getFinalMetrics };
};