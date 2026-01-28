export const analyzeStandingHeadPose = (poseLandmarks, headDownTimer) => {
    if (!poseLandmarks) return { status: "No Body", isGood: false };

    const nose = poseLandmarks[0];
    const leftEar = poseLandmarks[7];
    const rightEar = poseLandmarks[8];

    if (!nose || !leftEar || !rightEar) return { status: "Checking Head...", isGood: false };

    const avgEarY = (leftEar.y + rightEar.y) / 2;

    if (nose.y > avgEarY + 0.03) {
        if (!headDownTimer.current) headDownTimer.current = Date.now();
        if (Date.now() - headDownTimer.current > 2000) return { status: "Look Up!", isGood: false };
        return { status: "Glancing Down...", isGood: true };
    } else {
        headDownTimer.current = null;
        return { status: "Good Head Position", isGood: true };
    }
};

export const analyzeStandingPosture = (poseLandmarks, leaningTimer, bodyTurnTimer) => {
    // Safety check: Ensure body landmarks are detected
    if (!poseLandmarks) return { status: "No Body", isGood: false };
    // Extract Shoulder Landmarks
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];

    if (!leftShoulder || !rightShoulder) return { status: "Checking Body...", isGood: false };

    // Leaning Check: Calculate vertical difference between shoulders
    const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);

    // If slope > 0.08, user is leaning. Warn only if it persists for 3 seconds.
    if (shoulderSlope > 0.08) {
        if (!leaningTimer.current) leaningTimer.current = Date.now();
        if (Date.now() - leaningTimer.current > 3000) return { status: "Straighten Up!", isGood: false };
    } else {
        leaningTimer.current = null;
    }

    // Rotation Check (3D): Compare depth (Z-axis) to see if user is turned sideways
    const depthDiff = Math.abs(leftShoulder.z - rightShoulder.z);

    // If depth diff > 0.15, user is not facing camera. Warn after 2 seconds.
    if (depthDiff > 0.15) {
        if (!bodyTurnTimer.current) bodyTurnTimer.current = Date.now();
        if (Date.now() - bodyTurnTimer.current > 2000) return { status: "Face Forward!", isGood: false };
    } else {
        bodyTurnTimer.current = null;
    }

    return { status: "Good Posture", isGood: true };
};

export const analyzeStageMovement = (poseLandmarks, positionHistory, staticTimer, dynamicFeedbackTimer) => {
    // --- 1. Safety Checks ---
    if (!poseLandmarks) return { status: "No Body", isGood: false };

    // Track Hips (Center of Mass) to avoid head-movement noise
    const leftHip = poseLandmarks[23];
    const rightHip = poseLandmarks[24];

    if (!leftHip || !rightHip) return { status: "Track Body...", isGood: false };

    // --- 2. Data Collection (Time Series) ---
    const currentX = (leftHip.x + rightHip.x) / 2;
    const now = Date.now();
    positionHistory.push({ x: currentX, time: now });

    // Sliding Window: Keep only the last 5 seconds of data (FIFO)
    const TIME_WINDOW = 5000;
    while (positionHistory.length > 0 && now - positionHistory[0].time > TIME_WINDOW) {
        positionHistory.shift();
    }
    
    // Wait for sufficient data points
    if (positionHistory.length < 10) return { status: "Analyzing...", isGood: true };

    // Calculate spatial range (How much of the stage is used?)
    const xValues = positionHistory.map(p => p.x);
    const range = Math.max(...xValues) - Math.min(...xValues);

    // --- 3. Oscillation Detection (Pacing) ---
    let directionChanges = 0;
    let lastTurningPoint = positionHistory[0].x; 
    let isMovingRight = null; 
    
    for (let i = 1; i < positionHistory.length; i++) {
        const p = positionHistory[i].x;
        const distFromTurn = p - lastTurningPoint;
        
        // Noise Filter: Ignore small jitters (< 8% of screen)
        if (Math.abs(distFromTurn) > 0.08) {
            const currentMoveDir = distFromTurn > 0; 
            
            // Initialize direction
            if (isMovingRight === null) isMovingRight = currentMoveDir;
            
            // Detect direction flip
            else if (isMovingRight !== currentMoveDir) {
                directionChanges++;
                lastTurningPoint = p; 
                isMovingRight = currentMoveDir;
            }
        }
    }

    // Threshold: 3 changes in 5 seconds indicates nervous pacing
    if (directionChanges >= 3) {
        staticTimer.current = null;
        return { status: "Stop Pacing!", isGood: false };
    }

    // --- 4. Anchoring vs. Dynamic Movement ---
    
    // Case A: Anchoring (Movement range < 20%)
    if (range < 0.20) {
        if (!staticTimer.current) staticTimer.current = Date.now();
        const timeStuck = Date.now() - staticTimer.current;

        // Allow standing still for 45s, then encourage movement
        if (timeStuck < 45000) return { status: "Anchored (Good)", isGood: true };
        else if (timeStuck < 50000) return { status: "Move Around!", isGood: false }; 
        else {
            staticTimer.current = Date.now(); // Reset timer
            return { status: "Anchored (Good)", isGood: true };
        }
    } 
    
    // Case B: Dynamic Movement (Range > 22%)
    else if (range > 0.22) {
        staticTimer.current = null; 

        if (!dynamicFeedbackTimer.current) dynamicFeedbackTimer.current = Date.now();
        const timeSinceFeedback = Date.now() - dynamicFeedbackTimer.current;

        // Throttling: Show feedback every 80s or immediately at start
        if (timeSinceFeedback > 80000) {
            dynamicFeedbackTimer.current = Date.now();
            return { status: "Dynamic Movement", isGood: true };
        }
        
        if (timeSinceFeedback < 4000) return { status: "Dynamic Movement", isGood: true };
        
        return { status: "Active (Good)", isGood: true };
    }
    
    else {
        staticTimer.current = null;
        return { status: "Active (Good)", isGood: true };
    }
};

export const analyzeHandGestures = (poseLandmarks, crossedArmsTimer, faceTouchTimer, figLeafTimer, handsLowTimer, noGesturesTimer) => {
    // --- 1. Safety Checks ---
    if (!poseLandmarks) return { status: "No Body", isGood: false };

    // Extract key landmarks using MediaPipe indexes
    const leftWrist = poseLandmarks[15];
    const rightWrist = poseLandmarks[16];
    const leftHip = poseLandmarks[23];
    const rightHip = poseLandmarks[24];
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    const nose = poseLandmarks[0];

    // Ensure all required points are detected
    if (!leftWrist || !rightWrist || !leftHip || !rightHip || !nose) return { status: "Tracking...", isGood: false };

    // --- 2. Geometric Calculations ---
    // Calculate average vertical levels (Y-axis) for hips, shoulders, and wrists
    const hipLevel = (leftHip.y + rightHip.y) / 2;
    const shoulderLevel = (leftShoulder.y + rightShoulder.y) / 2;
    const wristsLevel = (leftWrist.y + rightWrist.y) / 2;
    
    // Calculate Euclidean distance between wrists
    const wristsDistance = Math.sqrt(Math.pow(leftWrist.x - rightWrist.x, 2) + Math.pow(leftWrist.y - rightWrist.y, 2));

    // --- 3. Visibility Check ---
    // If wrists visibility is low (< 0.3), assume hands are hidden/behind back
    if (leftWrist.visibility < 0.3 && rightWrist.visibility < 0.3) {
        // Reset all timers since we lost track of hands
        crossedArmsTimer.current = null;
        faceTouchTimer.current = null;
        figLeafTimer.current = null;
        handsLowTimer.current = null;
        return { status: "Show Hands!", isGood: false };
    }

    // --- 4. Face Touch Detection ---
    // Calculate distance from each wrist to the nose
    const leftDistToFace = Math.sqrt(Math.pow(leftWrist.x - nose.x, 2) + Math.pow(leftWrist.y - nose.y, 2));
    const rightDistToFace = Math.sqrt(Math.pow(rightWrist.x - nose.x, 2) + Math.pow(rightWrist.y - nose.y, 2));

    // Trigger warning if hands are too close to face for > 1.5 seconds
    if (leftDistToFace < 0.15 || rightDistToFace < 0.15) {
        if (!faceTouchTimer.current) faceTouchTimer.current = Date.now();
        if (Date.now() - faceTouchTimer.current > 1500) return { status: "Don't Touch Face", isGood: false };
    } else { faceTouchTimer.current = null; }

    // --- 5. Define Posture Zones (Boolean Logic) ---
    // Fig Leaf: Hands close together + below hips (Defensive pose)
    const isFigLeaf = wristsDistance < 0.20 && wristsLevel > (hipLevel - 0.1);
    
    // Crossed Arms: Hands close together + above hips
    const isCrossed = wristsDistance < 0.20 && wristsLevel < (hipLevel - 0.1);
    
    // High: Hands above shoulders
    const isHigh = wristsLevel < shoulderLevel - 0.05;
    
    // Power Box: Ideal zone (between shoulders and hips)
    const isPowerBox = wristsLevel > shoulderLevel && wristsLevel < (hipLevel - 0.05);
    
    // Low: Hands resting below hips
    const isLow = wristsLevel >= (hipLevel - 0.05);

    // --- 6. Timer-Based Feedback ---
    
    // Handle Fig Leaf (Allow 5 seconds grace period)
    if (isFigLeaf) {
        if (!figLeafTimer.current) figLeafTimer.current = Date.now();
        if (Date.now() - figLeafTimer.current > 5000) return { status: "Don't Protect!", isGood: false };
    } else { figLeafTimer.current = null; }

    // Handle Crossed Arms (Allow 15 seconds grace period)
    if (isCrossed) {
        if (!crossedArmsTimer.current) crossedArmsTimer.current = Date.now();
        if (Date.now() - crossedArmsTimer.current > 15000) return { status: "Uncross Arms", isGood: false };
    } else { crossedArmsTimer.current = null; }

    // Handle Hands Too Low (Allow 10 seconds grace period)
    if (isLow && !isFigLeaf) {
        if (!handsLowTimer.current) handsLowTimer.current = Date.now();
        if (Date.now() - handsLowTimer.current > 10000) return { status: "Hands Too Low", isGood: false };
    } else { handsLowTimer.current = null; }

    // Handle Power Box / Lack of Gestures
    if (isPowerBox) {
        noGesturesTimer.current = null; // Reset timer if using gestures
        return { status: "Power Box!", isGood: true };
    } else {
        // If not in power box for > 30 seconds, encourage movement
        if (!noGesturesTimer.current) noGesturesTimer.current = Date.now();
        if (Date.now() - noGesturesTimer.current > 30000) return { status: "Use Your Hands!", isGood: false };
    }

    // --- 7. Immediate Feedback (No specific error) ---
    if (isHigh) return { status: "Hands Too High!", isGood: false };
    if (isLow) return { status: "Resting", isGood: true };
    if (isCrossed) return { status: "Good Gestures", isGood: true }; // Temporarily allowed (under timer limit)
    if (isFigLeaf) return { status: "Good Gestures", isGood: true }; // Temporarily allowed (under timer limit)

    return { status: "Good Gestures", isGood: true };
};

export const analyzeAudienceScanning = (poseLandmarks, scanningTimer) => {
    if (!poseLandmarks) return { status: "Tracking...", isGood: false };

    const nose = poseLandmarks[0];
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];

    if (!nose || !leftShoulder || !rightShoulder) return { status: "Tracking...", isGood: false };

    // Find body center anchor
    const shouldersCenter = (leftShoulder.x + rightShoulder.x) / 2;

    // Use shoulder width for scale-invariant calculation
    const shouldersWidth = Math.abs(leftShoulder.x - rightShoulder.x);

    const distFromCenter = Math.abs(nose.x - shouldersCenter);

    // Check if nose is within 20% deviation from center
    const isLookingCenter = distFromCenter < (shouldersWidth * 0.2); 

    if (isLookingCenter) {
        if (!scanningTimer.current) scanningTimer.current = Date.now();

        // Warn if staring at center > 25s 
        if (Date.now() - scanningTimer.current > 25000) return { status: "Scan the Room!", isGood: false };

        return { status: "Looking Center", isGood: true };
    } else {
        // Reset timer if scanning
        scanningTimer.current = null;
        return { status: "Great Scanning!", isGood: true };
    }
};

export const analyzeDistance = (poseLandmarks, faceLandmarks) => {
    if (!poseLandmarks) return { status: "No Body", isGood: false };
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    if (leftShoulder && rightShoulder) {
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        if (shoulderWidth < 0.12) return { status: "Step Closer", isGood: false };
        if (shoulderWidth > 0.45) return { status: "Step Back", isGood: false };
    }
    if (faceLandmarks && faceLandmarks.length > 0) {
        const leftCheek = faceLandmarks[454];
        const rightCheek = faceLandmarks[234];
        if (leftCheek && rightCheek) {
            const faceWidth = Math.abs(leftCheek.x - rightCheek.x);
            if (faceWidth > 0.15) return { status: "Step Back", isGood: false };
        }
    }
    return { status: "Perfect Distance", isGood: true };
};