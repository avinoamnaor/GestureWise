import { useState, useRef } from 'react';
import { 
    analyzeLighting, 
    analyzeEyeContact, 
    analyzeHeadTilt, 
    analyzeCameraHeight, 
    analyzeChinPitch, 
    analyzeShoulderStability, 
    analyzeBodyAndHands, 
    analyzeCenteringAndDistance, 
    analyzeEngagement, 
    analyzeExpression
} from '../utils/sittingAnalysis';

export const useSittingLogic = () => {
    // --- 1. UI State (What user sees) ---
    const [uiFeedback, setUiFeedback] = useState({
        lighting: "Checking...",
        eyeContact: "Good Contact",
        headTilt: "Straight",
        chin: "Checking...",
        cameraHeight: "Checking...",
        shoulders: "Checking...",
        body: "Hands Open",
        centering: "Centered",
        distance: "Checking...",
        engagement: "Balanced",
        expression: "Neutral",
        brow: "Neutral",
        squint: "Eyes Open"
    });
    
    const [smartToast, setSmartToast] = useState(null);
    const [liveScore, setLiveScore] = useState(100);

    // --- 2. Immediate Refs (Flicker prevention) ---
    const feedbackRef = useRef({
        lighting: "Checking...",
        eyeContact: "Good Contact",
        headTilt: "Straight",
        chin: "Checking...",
        cameraHeight: "Checking...",
        shoulders: "Checking...",
        body: "Hands Open",
        centering: "Centered",
        distance: "Checking...",
        engagement: "Balanced", 
        expression: "Neutral",
        brow: "Neutral",
        squint: "Eyes Open"
    });

    const scoreRef = useRef(100);
    const sessionStatsRef = useRef({
        eyesBadFrames: 0,
        centerBadFrames: 0,
        handsBadFrames: 0,
        totalFrames: 0,
        goodVolumeFrames: 0,
        smilingFrames: 0
    });

    // Stability Timers
    const eyeStabilityRef = useRef(0);
    const centerStabilityRef = useRef(0);
    const handsStabilityRef = useRef(0);
    const chinStabilityRef = useRef(0);      
    const headTiltStabilityRef = useRef(0);  
    const shoulderStabilityRef = useRef(0);
    const lowVolumeTimerRef = useRef(0);
    const engagementStabilityTimer = useRef(0);
    const lastEngagementCandidate = useRef("Balanced");

    const lastDetectedTiltRef = useRef("Straight");   
    const lastBadChinRef = useRef("Chin Level"); 
    const lastShoulderStatusRef = useRef("Posture Great");

    // --- Main Processing Function ---
    const processSittingFrame = (faceResult, poseResult, videoElement, audioVol) => {
        const faceLms = faceResult.faceLandmarks?.[0];
        const poseLms = poseResult.landmarks?.[0];
        const blendshapes = faceResult.faceBlendshapes?.[0];

        sessionStatsRef.current.totalFrames++;
        let isFramePerfect = true;
        let alertMessage = null;
        
        const currentData = feedbackRef.current;

        // 1. Lighting
        const lightRes = analyzeLighting(videoElement);
        currentData.lighting = lightRes.status;

        // 2. Audio Volume
        if (audioVol > 20) sessionStatsRef.current.goodVolumeFrames++;
        
        // Count frames of silence
        if (audioVol < 10) lowVolumeTimerRef.current++;
        else lowVolumeTimerRef.current = 0;

        // Trigger warning after about 5 seconds
        if (lowVolumeTimerRef.current > 160) {
            isFramePerfect = false;
            // Apply penalty every 200 frames to create a pulsing effect
            if ((lowVolumeTimerRef.current - 160) % 200 === 0) {
                scoreRef.current = Math.max(0, scoreRef.current - 2);
                alertMessage = { text: "Speak Louder!", type: "warning" };
            }
        }

        // 3. Eyes & Expression
        if (blendshapes) {
            const eyeRes = analyzeEyeContact(blendshapes.categories);
            
            // Filter out natural blinks (+1), fast recovery (-2)
            if (!eyeRes.isGood) eyeStabilityRef.current++;
            else eyeStabilityRef.current = Math.max(0, eyeStabilityRef.current - 2);

            // Update sidebar status after short duration
            if (eyeStabilityRef.current > 15) currentData.eyeContact = "Looking Away";
            else currentData.eyeContact = eyeRes.status === "Reading Text" ? "Reading Text" : "Good Contact";

            // Penalty Threshold
            if (eyeStabilityRef.current > 30) {
                isFramePerfect = false;
                // Apply penalty every 40 frames while looking away
                if ((eyeStabilityRef.current - 40) % 40 === 0) {
                    scoreRef.current = Math.max(0, scoreRef.current - 3);
                    sessionStatsRef.current.eyesBadFrames += 40;
                    alertMessage = { text: "Keep Eye Contact", type: "warning" };
                }
            }

            const exprRes = analyzeExpression(blendshapes.categories);
            if (exprRes.smile.isSmiling) {
                sessionStatsRef.current.smilingFrames++;
                currentData.expression = exprRes.smile.status;
            } else currentData.expression = "Neutral";
            currentData.brow = exprRes.brow;
            currentData.squint = exprRes.squint;
        }

        // 4. Body & Hands
        if (poseLms && faceLms) {
            const bodyRes = analyzeBodyAndHands(poseLms, faceLms);
            
            // Build pressure on error (+1), fast recovery on fix (-2)
            if (!bodyRes.isGood) handsStabilityRef.current++;
            else handsStabilityRef.current = Math.max(0, handsStabilityRef.current - 2);
            
            // Update sidebar status after 15 frames
            if (handsStabilityRef.current > 15) currentData.body = "Don't touch face";
            else currentData.body = "Hands Open";
            
            // Penalty Threshold
            if (handsStabilityRef.current > 30) {
                isFramePerfect = false;
                // Apply penalty every 30 frames while error continues
                if ((handsStabilityRef.current - 30) % 30 === 0) {
                    scoreRef.current = Math.max(0, scoreRef.current - 5);
                    sessionStatsRef.current.handsBadFrames += 30;
                    alertMessage = { text: "Hands off Face!", type: "danger" };
                }
            }

            const shoulderRes = analyzeShoulderStability(poseLms);
            if (!shoulderRes.isLevel) shoulderStabilityRef.current++;
            else shoulderStabilityRef.current = Math.max(0, shoulderStabilityRef.current - 2);

            // Keep showing error for a bit to stop flickering
            if (shoulderStabilityRef.current > 45) {
                currentData.shoulders = "Uneven Shoulders";
                lastShoulderStatusRef.current = "Uneven Shoulders";
            } else if (shoulderStabilityRef.current === 0) {
                currentData.shoulders = "Posture Great";
                lastShoulderStatusRef.current = "Posture Great";
            } else {
                currentData.shoulders = lastShoulderStatusRef.current;
            }

            // Apply penalty every 90 frames while shoulders are uneven
            if (shoulderStabilityRef.current > 60) {
                isFramePerfect = false;
                if ((shoulderStabilityRef.current - 60) % 90 === 0) {
                    scoreRef.current = Math.max(0, scoreRef.current - 5);
                    alertMessage = { text: "Fix Shoulders", type: "warning" };
                }
            }
        }

        // 5. Positioning & Head
        if (faceLms) {
            const posRes = analyzeCenteringAndDistance(faceLms, poseLms);
            if (!posRes.isCentered) centerStabilityRef.current++;
            else centerStabilityRef.current = 0;

            if (centerStabilityRef.current > 20) currentData.centering = posRes.centerStatus;
            else currentData.centering = "Centered";

            if (centerStabilityRef.current > 40) {
                isFramePerfect = false;
                // Apply penalty every 40 frames while out of frame
                if ((centerStabilityRef.current - 40) % 40 === 0) {
                    scoreRef.current = Math.max(0, scoreRef.current - 4);
                    sessionStatsRef.current.centerBadFrames += 40;
                    alertMessage = { text: posRes.centerStatus, type: "warning" };
                }
            }
            currentData.distance = posRes.distStatus;

            const rawTilt = analyzeHeadTilt(faceLms);
            if (rawTilt.includes("Too Tilted")) headTiltStabilityRef.current++;
            else headTiltStabilityRef.current = Math.max(0, headTiltStabilityRef.current - 2);

            // Stick to error message until fully stable
            if (headTiltStabilityRef.current > 30) {
                currentData.headTilt = rawTilt;
                lastDetectedTiltRef.current = rawTilt;
            } else if (headTiltStabilityRef.current === 0) {
                currentData.headTilt = "Straight";
            } else {
                currentData.headTilt = lastDetectedTiltRef.current;
            }

            // Apply penalty every 90 frames
            if (headTiltStabilityRef.current > 55) {
                isFramePerfect = false;
                if ((headTiltStabilityRef.current - 60) % 90 === 0) {
                    scoreRef.current = Math.max(0, scoreRef.current - 5);
                    alertMessage = { text: "Straighten Head", type: "warning" };
                }
            }

            const rawChin = analyzeChinPitch(faceLms);
            // Build pressure on error (+1), fast recovery on fix (-2)
            if (rawChin.includes("Too") || rawChin.includes("Tucked")) chinStabilityRef.current++;
            else chinStabilityRef.current = Math.max(0, chinStabilityRef.current - 2);

            // Keep error visible while correcting to prevent jitter
            if (chinStabilityRef.current > 45) {
                currentData.chin = rawChin;
                lastBadChinRef.current = rawChin;
            } else if (chinStabilityRef.current === 0) {
                currentData.chin = "Chin Level";
            } else {
                currentData.chin = lastBadChinRef.current;
            }

            // Apply penalty every 90 frames while chin is bad
            if (chinStabilityRef.current > 60) {
                 isFramePerfect = false;
                 if ((chinStabilityRef.current - 60) % 90 === 0) {
                     scoreRef.current = Math.max(0, scoreRef.current - 5);
                     alertMessage = { text: "Adjust Chin", type: "warning" };
                 }
            }

            currentData.cameraHeight = analyzeCameraHeight(faceLms);

            // Only update if new state persists for 20 frames
            if (poseLms) {
                const currentRawEngagement = analyzeEngagement(poseLms);
                if (currentRawEngagement !== currentData.engagement) {
                    if (currentRawEngagement === lastEngagementCandidate.current) {
                        engagementStabilityTimer.current++;
                    } else {
                        engagementStabilityTimer.current = 0;
                        lastEngagementCandidate.current = currentRawEngagement;
                    }
                    if (engagementStabilityTimer.current > 20) {
                        currentData.engagement = currentRawEngagement; 
                        engagementStabilityTimer.current = 0;
                    }
                } else {
                    engagementStabilityTimer.current = 0;
                }
            }
        }

        // Score Recovery
        if (isFramePerfect) {
            scoreRef.current = Math.min(100, scoreRef.current + 0.01);
        }

        // 6. Alert System
        // Keep message visible for 3s to prevent flickering
        if (alertMessage) {
            setSmartToast(alertMessage);
            setTimeout(() => setSmartToast(null), 3000);
        }

        // Update UI with the latest data from Ref
        setUiFeedback({ ...currentData });

        if (Math.round(scoreRef.current) !== liveScore) {
            setLiveScore(Math.round(scoreRef.current));
        }
    };

    return {
        sittingFeedback: { ...uiFeedback, smartToast }, 
        liveScore,       
        processSittingFrame, 
        sessionStatsRef, 
        scoreRef         
    };
};