import { useState, useRef, useCallback } from 'react';

// --- הגדרות הניקוד והרגישות ---
const CONFIG = {
    STARTING_SCORE: 100,
    MAX_SCORE: 100,
    
    // כמה נקודות יורד על כל "פעימה" של טעות (בכל פריים שהטעות קורית)
    PENALTY: {
        CENTERING: 0.5, // יורד מהר מאוד
        EYES: 0.2,      // יורד בקצב בינוני
        POSTURE: 0.1,   // יורד לאט
        FACE_TOUCH: 0.1
    },
    // קצב הריפוי (כמה נקודות עולה כשהכל תקין)
    HEALING_RATE: 0.05, 
    
    // סף רגישות (כמה פריימים רצופים צריך כדי להחשיב טעות)
    THRESHOLDS: {
        EYES: 15,       // בערך חצי שנייה
        CENTERING: 10,  // תגובה מהירה ליציאה מהפריים
        POSTURE: 40,    // סלחני יותר
        HEALING_WAIT: 60 // צריך שנתיים של "שקט" כדי להתחיל לתקן ציון
    },

    // זמן צינון להתראות (במילישניות) - כדי לא "לחפור" למשתמש
    NOTIFICATION_COOLDOWN: 5000 // 5 שניות שקט בין התראה להתראה
};

export const useSittingLogic = () => {
    // === State (מה שה-UI רואה) ===
    const [score, setScore] = useState(CONFIG.STARTING_SCORE);
    const [feedback, setFeedback] = useState(null); // { message: string, color: string }

    // === Refs (זיכרון פנימי של המוח) ===
    const scoreRef = useRef(CONFIG.STARTING_SCORE);
    const healingTimer = useRef(0); // רצף התנהגות טובה
    const lastNotificationTime = useRef(0); // מתי בפעם האחרונה הצקנו למשתמש?

    // מונים לזיהוי טעויות (Debounce)
    const timers = useRef({
        eyes: 0,
        center: 0,
        posture: 0,
        hands: 0
    });

    // חישוב שונות לקריאה (כדי לא להעניש על קריאת טלפרומפטר)
    const calculateVariance = (arr) => {
        if (arr.length === 0) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    };
    const gazeHistory = useRef([]);

    // === הפונקציה הראשית שרצה כל פריים ===
    const processFrame = useCallback((faceLms, poseLms, blendshapes) => {
        let isPerfectFrame = true; // הנחה אופטימית
        let currentProblem = null; // הבעיה הכי חמורה כרגע (לטובת ההתראה)

        // 1. בדיקת מרכוז (Centering)
        if (faceLms) {
            const nose = faceLms[1];
            if (nose.x < 0.35 || nose.x > 0.65) { 
                timers.current.center++;
                // אם עברנו את הסף - מתחילים להעניש
                if (timers.current.center > CONFIG.THRESHOLDS.CENTERING) {
                    isPerfectFrame = false;
                    // הורדת ציון (קורה בכל פריים כל עוד הבעיה נמשכת!)
                    scoreRef.current = Math.max(0, scoreRef.current - CONFIG.PENALTY.CENTERING);
                    // הכנת התראה (תישלח רק אם ה-Cooldown מאפשר)
                    currentProblem = { msg: "מרכז את עצמך מול המצלמה 🎯", color: "danger" };
                }
            } else {
                timers.current.center = 0;
            }
        }

        // 2. בדיקת קשר עין (Eye Contact)
        if (blendshapes && !currentProblem) { 
            const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;
            const gazeX = getScore('eyeLookInLeft') - getScore('eyeLookOutLeft');
            const gazeY = getScore('eyeLookUpLeft') - getScore('eyeLookDownLeft');

            // זיהוי קריאה
            gazeHistory.current.push(gazeX);
            if (gazeHistory.current.length > 30) gazeHistory.current.shift();
            const variance = calculateVariance(gazeHistory.current);
            const isReading = variance > 0.001 && variance < 0.015;

            // אם מביט הצידה וגם לא קורא
            if ((Math.abs(gazeX) > 0.5 || Math.abs(gazeY) > 0.5) && !isReading) {
                timers.current.eyes++;
                if (timers.current.eyes > CONFIG.THRESHOLDS.EYES) {
                    isPerfectFrame = false;
                    // ענישה רציפה על הציון
                    scoreRef.current = Math.max(0, scoreRef.current - CONFIG.PENALTY.EYES);
                    // הכנת התראה
                    currentProblem = { msg: "שמור על קשר עין עם הקהל 👀", color: "warning" };
                }
            } else {
                timers.current.eyes = Math.max(0, timers.current.eyes - 2); 
            }
        }

        // 3. בדיקת ידיים (Hands)
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
                    currentProblem = { msg: "הרחק ידיים מהפנים ✋", color: "warning" };
                }
            } else {
                timers.current.hands = 0;
            }
        }

        // === סיכום הפריים ===

        // א. מנגנון ריפוי (Healing)
        if (isPerfectFrame) {
            healingTimer.current++;
            // רק אחרי שהיית ילד טוב מספיק זמן - הציון מתחיל לעלות
            if (healingTimer.current > CONFIG.THRESHOLDS.HEALING_WAIT) {
                scoreRef.current = Math.min(CONFIG.MAX_SCORE, scoreRef.current + CONFIG.HEALING_RATE);
            }
        } else {
            healingTimer.current = 0; // איפוס רצף הצלחות
        }

        // ב. ניהול התראות חכם (Manager)
        const now = Date.now();
        
        // בודקים: 1. יש בעיה? 2. עבר מספיק זמן מההודעה האחרונה?
        if (currentProblem && (now - lastNotificationTime.current > CONFIG.NOTIFICATION_COOLDOWN)) {
            setFeedback(currentProblem); // מציג את ההודעה
            lastNotificationTime.current = now; // מאפס את הטיימר (שקט ל-5 שניות הקרובות)
            
            // מעלים את ההודעה אחרי 3 שניות
            setTimeout(() => setFeedback(null), 3000);
        }

        // ג. סנכרון ל-State (רק אם הציון זז משמעותית כדי לא להכביד)
        if (Math.abs(scoreRef.current - score) > 0.5) {
            setScore(Math.round(scoreRef.current));
        }

    }, [score]);

    return {
        score,          // הציון לתצוגה
        feedback,       // ההתראה לתצוגה
        processFrame    // הפונקציה שנקרא לה
    };
};