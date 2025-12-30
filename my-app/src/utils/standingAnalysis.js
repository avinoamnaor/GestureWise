// src/utils/standingAnalysis.js

/**
 * 1. בדיקת זווית ראש (האם המרצה משפיל מבט?) - עם השהייה של 2 שניות
 * @param {Array} poseLandmarks 
 * @param {Object} headDownTimer - טיימר למדידת זמן השפלת מבט
 */
export const analyzeStandingHeadPose = (poseLandmarks, headDownTimer) => {
    if (!poseLandmarks) return { status: "No Body", isGood: false };

    const nose = poseLandmarks[0];
    const leftEar = poseLandmarks[7];
    const rightEar = poseLandmarks[8];

    if (!nose || !leftEar || !rightEar) return { status: "Checking Head...", isGood: false };

    const avgEarY = (leftEar.y + rightEar.y) / 2;

    // בדיקה: האם האף נמוך מהאוזניים? (Looking Down)
    if (nose.y > avgEarY + 0.03) {
        // התחלנו להשפיל מבט -> נפעיל טיימר
        if (!headDownTimer.current) {
            headDownTimer.current = Date.now();
        }

        // אם עברו מעל 2000 מילישניות (2 שניות)
        if (Date.now() - headDownTimer.current > 2000) {
            return { status: "Look Up! 🙄", isGood: false };
        }
        
        // בזמן הספירה לאחור, אנחנו עדיין "בסדר" (נותנים למשתמש זמן לתקן)
        return { status: "Glancing Down... 👀", isGood: true };

    } else {
        // הרמנו ראש -> מאפסים את הטיימר
        headDownTimer.current = null;
        return { status: "Good Head Pos. 👀", isGood: true };
    }
};

/**
 * 2. בדיקת יציבה משולבת - עם השהייה (Grace Period)
 * @param {Array} poseLandmarks 
 * @param {Object} leaningTimer - טיימר לכתפיים עקומות (3 שניות)
 * @param {Object} bodyTurnTimer - טיימר לסיבוב גוף (2 שניות)
 */
export const analyzeStandingPosture = (poseLandmarks, leaningTimer, bodyTurnTimer) => {
    if (!poseLandmarks) return { status: "No Body", isGood: false };

    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];

    if (!leftShoulder || !rightShoulder) return { status: "Checking Body...", isGood: false };

    // --- בדיקה א': כתפיים עקומות ---
    const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);
    
    if (shoulderSlope > 0.08) {
        if (!leaningTimer.current) leaningTimer.current = Date.now();

        // נותנים 3 שניות של חסד להעברת משקל
        if (Date.now() - leaningTimer.current > 3000) {
            return { status: "Straighten Up! ⚖️", isGood: false };
        }
    } else {
        leaningTimer.current = null;
    }

    // --- בדיקה ב': גוף מסובב (עומק Z) ---
    const depthDiff = Math.abs(leftShoulder.z - rightShoulder.z);
    
    if (depthDiff > 0.25) { 
        if (!bodyTurnTimer.current) bodyTurnTimer.current = Date.now();

        // נותנים 2 שניות של חסד
        if (Date.now() - bodyTurnTimer.current > 2000) {
             return { status: "Face Forward! ↔️", isGood: false };
        }
    } else {
        bodyTurnTimer.current = null;
    }

    return { status: "Good Posture ✅", isGood: true };
};

/**
 * 3. בדיקת תנועה על הבמה - הגרסה היציבה (בלי נדנודים, רק עוגן מול תנועה)
 * @param {Array} poseLandmarks 
 * @param {Array} positionHistory 
 * @param {Object} staticTimer
 */
/**
 * ניתוח תנועה על הבמה - גרסת 40 השניות ⏱️
 * מציג "Dynamic Movement" בגדול רק פעם אחת ב-40 שניות.
 */
export const analyzeStageMovement = (poseLandmarks, positionHistory, staticTimer, dynamicFeedbackTimer) => {
    if (!poseLandmarks) return { status: "No Body", isGood: false };

    const leftHip = poseLandmarks[23];
    const rightHip = poseLandmarks[24];

    if (!leftHip || !rightHip) return { status: "Track Body...", isGood: false };

    // 1. חישוב וניהול היסטוריה
    const currentX = (leftHip.x + rightHip.x) / 2;
    const now = Date.now();
    positionHistory.push({ x: currentX, time: now });

    const TIME_WINDOW = 5000; // חלון בדיקה של 5 שניות
    while (positionHistory.length > 0 && now - positionHistory[0].time > TIME_WINDOW) {
        positionHistory.shift();
    }
    if (positionHistory.length < 10) return { status: "Analyzing...", isGood: true };

    const xValues = positionHistory.map(p => p.x);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const range = maxX - minX;

    // 2. בדיקת Pacing (נמר בכלוב) - נשארת קבועה
    let directionChanges = 0;
    let lastTurningPoint = positionHistory[0].x; 
    let isMovingRight = null; 
    for (let i = 1; i < positionHistory.length; i++) {
        const p = positionHistory[i].x;
        const distFromTurn = p - lastTurningPoint;
        if (Math.abs(distFromTurn) > 0.08) {
            const currentMoveDir = distFromTurn > 0; 
            if (isMovingRight === null) isMovingRight = currentMoveDir;
            else if (isMovingRight !== currentMoveDir) {
                directionChanges++;
                lastTurningPoint = p; 
                isMovingRight = currentMoveDir;
            }
        }
    }
    if (directionChanges >= 5) {
        staticTimer.current = null;
        return { status: "Stop Pacing! 🐯", isGood: false };
    }

    // 3. לוגיקת התנועה והתזמון (השינוי הגדול)
    
    // א. עומד במקום (פחות מ-20%)
    if (range < 0.20) {
        if (!staticTimer.current) staticTimer.current = Date.now();
        const timeStuck = Date.now() - staticTimer.current;

        if (timeStuck < 20000) return { status: "Anchored (Good) ⚓", isGood: true };
        else if (timeStuck < 25000) return { status: "Move Around! 🏃", isGood: false }; // רק זה יקפוץ למסך
        else {
            staticTimer.current = Date.now(); // איפוס כדי לא לחפור
            return { status: "Anchored (Good) ⚓", isGood: true };
        }
    } 
    
    // ב. זז יפה (מעל 30%)
    else if (range > 0.30) {
        staticTimer.current = null; // איפוס טיימר הקיפאון

        // אם אין טיימר מחמאות פעיל, נתחיל אחד עכשיו
        if (!dynamicFeedbackTimer.current) {
            dynamicFeedbackTimer.current = Date.now();
        }

        const timeSinceFeedback = Date.now() - dynamicFeedbackTimer.current;

        // תנאי 1: עברו יותר מ-40 שניות מאז המחמאה האחרונה? -> תאפס ותן מחמאה חדשה
        if (timeSinceFeedback > 40000) {
            dynamicFeedbackTimer.current = Date.now();
            return { status: "Dynamic Movement 🕺", isGood: true };
        }

        // תנאי 2: אנחנו בתוך ה-4 שניות הראשונות של המחמאה? -> תציג אותה
        if (timeSinceFeedback < 4000) {
            return { status: "Dynamic Movement 🕺", isGood: true };
        }

        // תנאי 3: אנחנו בזמן המתנה (בין 4 ל-40 שניות) -> תהיה בשקט
        // הסטטוס "Active" לא מקפיץ את ה-Overlay הגדול, רק מופיע בבאר למטה
        return { status: "Active (Good) 👍", isGood: true };
    }

    // ג. מצב ביניים (בין 20% ל-30%) - סתם פעיל
    else {
        staticTimer.current = null;
        return { status: "Active (Good) 👍", isGood: true };
    }
};

/**
 * 4. בדיקת ידיים חכמה - עם כל הטיימרים
 */
export const analyzeHandGestures = (poseLandmarks, crossedArmsTimer, faceTouchTimer, figLeafTimer, handsLowTimer, noGesturesTimer) => {
    if (!poseLandmarks) return { status: "No Body", isGood: false };

    const leftWrist = poseLandmarks[15];
    const rightWrist = poseLandmarks[16];
    const leftHip = poseLandmarks[23];
    const rightHip = poseLandmarks[24];
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    const nose = poseLandmarks[0];

    if (!leftWrist || !rightWrist || !leftHip || !rightHip || !nose) return { status: "Tracking...", isGood: false };

    const hipLevel = (leftHip.y + rightHip.y) / 2;
    const shoulderLevel = (leftShoulder.y + rightShoulder.y) / 2;
    const wristsLevel = (leftWrist.y + rightWrist.y) / 2;
    const wristsDistance = Math.sqrt(Math.pow(leftWrist.x - rightWrist.x, 2) + Math.pow(leftWrist.y - rightWrist.y, 2));

    if (leftWrist.visibility < 0.3 && rightWrist.visibility < 0.3) {
        crossedArmsTimer.current = null;
        faceTouchTimer.current = null;
        figLeafTimer.current = null;
        handsLowTimer.current = null;
        return { status: "Show Hands! 🙈", isGood: false };
    }

    const leftDistToFace = Math.sqrt(Math.pow(leftWrist.x - nose.x, 2) + Math.pow(leftWrist.y - nose.y, 2));
    const rightDistToFace = Math.sqrt(Math.pow(rightWrist.x - nose.x, 2) + Math.pow(rightWrist.y - nose.y, 2));

    if (leftDistToFace < 0.15 || rightDistToFace < 0.15) {
        if (!faceTouchTimer.current) faceTouchTimer.current = Date.now();
        if (Date.now() - faceTouchTimer.current > 1500) return { status: "Don't Touch Face 💆‍♂️", isGood: false };
    } else { faceTouchTimer.current = null; }

    const isFigLeaf = wristsDistance < 0.20 && wristsLevel > (hipLevel - 0.1);
    const isCrossed = wristsDistance < 0.20 && wristsLevel < (hipLevel - 0.1);
    const isHigh = wristsLevel < shoulderLevel - 0.05;
    const isPowerBox = wristsLevel > shoulderLevel && wristsLevel < (hipLevel - 0.05);
    const isLow = wristsLevel >= (hipLevel - 0.05);

    if (isFigLeaf) {
        if (!figLeafTimer.current) figLeafTimer.current = Date.now();
        if (Date.now() - figLeafTimer.current > 5000) return { status: "Don't Protect! ⚽", isGood: false };
    } else { figLeafTimer.current = null; }

    if (isCrossed) {
        if (!crossedArmsTimer.current) crossedArmsTimer.current = Date.now();
        if (Date.now() - crossedArmsTimer.current > 15000) return { status: "Uncross Arms 🙅‍♂️", isGood: false };
    } else { crossedArmsTimer.current = null; }

    if (isLow && !isFigLeaf) {
        if (!handsLowTimer.current) handsLowTimer.current = Date.now();
        if (Date.now() - handsLowTimer.current > 10000) return { status: "Hands Too Low 👇", isGood: false };
    } else { handsLowTimer.current = null; }

    if (isPowerBox) {
        noGesturesTimer.current = null;
        return { status: "Power Box! 💪", isGood: true };
    } else {
        if (!noGesturesTimer.current) noGesturesTimer.current = Date.now();
        if (Date.now() - noGesturesTimer.current > 30000) return { status: "Use Your Hands! 👋", isGood: false };
    }

    if (isHigh) return { status: "Hands Too High! 👇", isGood: false };

    if (isLow) return { status: "Resting 😌", isGood: true };
    if (isCrossed) return { status: "Good Gestures 👐", isGood: true };
    if (isFigLeaf) return { status: "Good Gestures 👐", isGood: true };

    return { status: "Good Gestures 👐", isGood: true };
};

/**
 * 5. המגדלור (Audience Scanning)
 */
export const analyzeAudienceScanning = (poseLandmarks, scanningTimer) => {
    if (!poseLandmarks) return { status: "Tracking...", isGood: false };
    const nose = poseLandmarks[0];
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    if (!nose || !leftShoulder || !rightShoulder) return { status: "Tracking...", isGood: false };

    const shouldersCenter = (leftShoulder.x + rightShoulder.x) / 2;
    const shouldersWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const distFromCenter = Math.abs(nose.x - shouldersCenter);
    const isLookingCenter = distFromCenter < (shouldersWidth * 0.2); 

    if (isLookingCenter) {
        if (!scanningTimer.current) scanningTimer.current = Date.now();
        if (Date.now() - scanningTimer.current > 15000) return { status: "Scan the Room! 🔦", isGood: false };
        return { status: "Looking Center 🎯", isGood: true };
    } else {
        scanningTimer.current = null;
        return { status: "Great Scanning! 👀", isGood: true };
    }
};

/**
 * בדיקת מרחק - גרסה משולבת (כתפיים + פנים) 📏
 * בודקת אם אתה קרוב מדי גם לפי רוחב כתפיים וגם לפי גודל הפנים בפריים.
 */
export const analyzeDistance = (poseLandmarks, faceLandmarks) => {
    // אם אין גוף בכלל
    if (!poseLandmarks) return { status: "No Body", isGood: false };

    // 1. בדיקת כתפיים (הקיימת)
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    
    if (leftShoulder && rightShoulder) {
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

        // רחוק מדי
        if (shoulderWidth < 0.12) return { status: "Step Closer 🔭", isGood: false };
        
        // קרוב מדי לפי כתפיים
        if (shoulderWidth > 0.45) return { status: "Step Back 🔙", isGood: false };
    }

    // 2. בדיקת פנים (החדשה! 🧠)
    // אם המצלמה רואה פנים, נבדוק את הגודל שלהן
    if (faceLandmarks && faceLandmarks.length > 0) {
        // נקודות קיצון של הפנים (אוזן לאוזן בערך) - מדיה-פייפ
        const leftCheek = faceLandmarks[454];
        const rightCheek = faceLandmarks[234];

        if (leftCheek && rightCheek) {
            const faceWidth = Math.abs(leftCheek.x - rightCheek.x);
            
            // אם הפנים תופסות יותר מ-15% מרוחב המסך -> זה זום-אין עצבני -> תתרחק!
            // (במצב עמידה מלא, הפנים אמורות להיות קטנות, בערך 5-8%)
            if (faceWidth > 0.15) {
                return { status: "Step Back 🔙", isGood: false };
            }
        }
    }

    return { status: "Perfect Dist. 👌", isGood: true };
};