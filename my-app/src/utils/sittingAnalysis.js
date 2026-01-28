// src/utils/sittingAnalysis.js

// Constants for calc
export const BRIGHTNESS_THRESHOLD = 30; 
export const SHOULDER_WIDTH_MIN = 0.25; 
export const SHOULDER_WIDTH_MAX = 0.65; 

// Calculate variance to see how much stats are jumping around
export const calculateVariance = (arr) => {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
};

// Checks if room lighting is good or too dark
export const analyzeLighting = (videoElement) => {
    try {
        const canvas = document.createElement('canvas'); canvas.width = 50; canvas.height = 50;
        const ctx = canvas.getContext('2d'); ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let totalBrightness = 0;
        for (let i = 0; i < frameData.length; i += 16) { totalBrightness += (frameData[i] + frameData[i + 1] + frameData[i + 2]) / 3; }
        const avgBrightness = totalBrightness / (frameData.length / 16);
        if (avgBrightness < BRIGHTNESS_THRESHOLD) return { status: "Too Dark", isGood: false };
        return { status: "Lighting Good", isGood: true };
    } catch (e) { return { status: "Checking...", isGood: true }; }
};

// Checks where eyes are looking and if I'm blinking
export const analyzeEyeContact = (blendshapes) => {
    if (!blendshapes) return { status: "No Face", isGood: false };
    const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;
    
    // Blinking check
    if (getScore('eyeBlinkLeft') > 0.5 || getScore('eyeBlinkRight') > 0.5) return { status: "Blinking", isGood: true };
    
    // Calc pupil direction
    const gazeX = getScore('eyeLookInLeft') - getScore('eyeLookOutLeft'); 
    const gazeY = getScore('eyeLookUpLeft') - getScore('eyeLookDownLeft');
    
    // If looking too much sideways or up/down
    if (Math.abs(gazeX) > 0.5 || Math.abs(gazeY) > 0.5) return { status: "Looking Away", isGood: false };
    
    return { status: "Good Contact", isGood: true };
};

// Checks if head is straight or tilting
export const analyzeHeadTilt = (landmarks) => {
    const angle = Math.atan2(landmarks[263].y - landmarks[33].y, landmarks[263].x - landmarks[33].x) * (180 / Math.PI);
    if (Math.abs(angle) < 8) return "Straight";
    if (Math.abs(angle) < 20) return "Slight Tilt";
    return "Too Tilted";
};

// Checks if camera height is good vs eyes
export const analyzeCameraHeight = (faceLandmarks) => {
    const avgEyeY = (faceLandmarks[33].y + faceLandmarks[263].y) / 2;
    if (avgEyeY < 0.25) return "Camera Too Low";
    if (avgEyeY > 0.55) return "Camera Too High";
    return "Height Perfect";
};

// Checks if chin is too high or low
export const analyzeChinPitch = (landmarks) => {
    // Landmarks: [1] Nose Tip, [33] Left Eye Inner Corner, [263] Right Eye Inner Corner
    const noseToEyeDist = landmarks[1].y - ((landmarks[33].y + landmarks[263].y) / 2);
    if (noseToEyeDist < 0.055) return "Chin Too High";
    if (noseToEyeDist > 0.12) return "Chin Tucked"; 
    return "Chin Level";
};

// Checks that shoulders are level not uneven
export const analyzeShoulderStability = (poseLandmarks) => {
    if(!poseLandmarks[11] || !poseLandmarks[12]) return { status: "No Shoulders", isLevel: false };
    if (Math.abs(poseLandmarks[11].y - poseLandmarks[12].y) > 0.04) return { status: "Uneven Shoulders", isLevel: false };
    return { status: "Posture Great", isLevel: true };
};

// Detects if hands touching face or hidden
export const analyzeBodyAndHands = (poseLandmarks, faceLandmarks) => {
    if (!poseLandmarks) return { status: "No Body", isGood: false };
    if (!faceLandmarks) return { status: "Hands Open", isGood: true };
    const xs = faceLandmarks.map(p => p.x); const ys = faceLandmarks.map(p => p.y);
    const pad = 0.05; 
    
    // Creates box around face
    const faceBox = { minX: Math.min(...xs)-pad, maxX: Math.max(...xs)+pad, minY: Math.min(...ys)-pad, maxY: Math.max(...ys)+pad };
    // Wrists (15,16) & Fingertips (17-22)
    const checkPoints = [15, 17, 19, 21, 16, 18, 20, 22];
    let isTouching = false;
    
    // Checks if hand points go inside face box
    for (let i = 0; i < checkPoints.length; i++) {
        const point = poseLandmarks[checkPoints[i]];
        if (point && point.visibility > 0.3 && point.x >= faceBox.minX && point.x <= faceBox.maxX && point.y >= faceBox.minY && point.y <= faceBox.maxY) {
            isTouching = true; break;
        }
    }
    if (isTouching) return { status: "Don't touch face", isGood: false };
    // If wrists visibility is low, hands are hidden
    if (!(poseLandmarks[15].visibility > 0.5 || poseLandmarks[16].visibility > 0.5)) return { status: "Hands Hidden", isGood: true };
    return { status: "Hands Open", isGood: true };
};

// Checks if I'm centered and at good distance
export const analyzeCenteringAndDistance = (faceLandmarks, poseLandmarks) => {
    const nose = faceLandmarks[1];
    let centerStatus = "Centered"; let isCentered = true;
    if (nose.x < 0.4) { centerStatus = "Move Left"; isCentered = false; } 
    else if (nose.x > 0.6) { centerStatus = "Move Right"; isCentered = false; }
    let distStatus = "Distance Perfect";
    if (poseLandmarks) {
        // Checks distance based on shoulder width
        const width = Math.abs(poseLandmarks[11].x - poseLandmarks[12].x);
        if (width < SHOULDER_WIDTH_MIN) distStatus = "Too Far"; else if (width > SHOULDER_WIDTH_MAX) distStatus = "Too Close";
    }
    return { centerStatus, isCentered, distStatus };
};

// Checks if leaning forward or back
export const analyzeEngagement = (poseLandmarks) => {
    const width = Math.abs(poseLandmarks[11].x - poseLandmarks[12].x);
    if (width > 0.55) return "Leaning In";
    if (width < 0.30) return "Leaning Back";
    return "Balanced Posture";
};

// Analyzes facial expressions smile brows etc
export const analyzeExpression = (blendshapes) => {
    const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;
    
    // Smile check
    const smile = (getScore('mouthSmileLeft') + getScore('mouthSmileRight')) / 2;
    let smileStat = { status: "Neutral", isSmiling: false };
    if (smile > 0.4) smileStat = { status: "Smiling", isSmiling: true };
    
    // Brows and energy
    const browUp = (getScore('browOuterUpLeft') + getScore('browOuterUpRight') + getScore('browInnerUp')) / 3;
    let browStat = browUp > 0.45 ? "High Energy" : (browUp > 0.2 ? "Expressive" : "Neutral");
    
    // Squinting check
    const squint = (getScore('eyeSquintLeft') + getScore('eyeSquintRight')) / 2;
    let squintStat = squint > 0.6 ? "Squinting" : "Eyes Open";
    
    return { smile: smileStat, brow: browStat, squint: squintStat };
};