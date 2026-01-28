import { useState, useRef } from 'react';
import { 
    analyzeStandingHeadPose, 
    analyzeStandingPosture, 
    analyzeStageMovement, 
    analyzeHandGestures, 
    analyzeAudienceScanning, 
    analyzeDistance 
} from '../utils/standingAnalysis';

export const useStandingLogic = () => {
    // --- 1. Display State ---
    const [postureStatus, setPostureStatus] = useState("Checking..."); 
    const [stageMovementStatus, setStageMovementStatus] = useState("Stand Still"); 
    const [handsActivityStatus, setHandsActivityStatus] = useState("Inactive"); 

    // --- 2. Timers & Memory (Refs) ---
    const movementHistoryRef = useRef([]); 
    
    // Detection Timers
    const crossedArmsTimerRef = useRef(null); 
    const faceTouchTimerRef = useRef(null); 
    const figLeafTimerRef = useRef(null); 
    const handsLowTimerRef = useRef(null);   
    const noGesturesTimerRef = useRef(null); 
    const staticTimerRef = useRef(null);
    const scanningTimerRef = useRef(null);
    const headDownTimerRef = useRef(null); 
    const leaningTimerRef = useRef(null);  
    const bodyTurnTimerRef = useRef(null);
    const dynamicFeedbackTimerRef = useRef(null);

    // --- 3. Throttling Managers ---
    const lastOverlayUpdateRef = useRef(0); // For main overlay
    const lastSidebarUpdateRef = useRef(0); // For sidebar

    // Session start timer
    const sessionStartTimeRef = useRef(null);

    // --- Main Process Function ---
    const processStandingFrame = (poseLms, faceLms) => {
        const now = Date.now();

        // Variables to hold final frame results
        let candidateOverlay = "Good Posture"; 
        let nextMoveStatus = stageMovementStatus; 
        let nextHandStatus = handsActivityStatus; 

        // --- Step 1: Body Detection ---
        if (!poseLms) {
            candidateOverlay = "Body not detected";
        } else {
            // Start session timer if body detected
            if (!sessionStartTimeRef.current) {
                sessionStartTimeRef.current = now;
            }

            // 1. Run all analyzers
            const distRes = analyzeDistance(poseLms, faceLms);
            const postureRes = analyzeStandingPosture(poseLms, leaningTimerRef, bodyTurnTimerRef);
            const headRes = analyzeStandingHeadPose(poseLms, headDownTimerRef);
            const scanRes = analyzeAudienceScanning(poseLms, scanningTimerRef);
            const moveRes = analyzeStageMovement(poseLms, movementHistoryRef.current, staticTimerRef, dynamicFeedbackTimerRef);
            const handsRes = analyzeHandGestures(poseLms, crossedArmsTimerRef, faceTouchTimerRef, figLeafTimerRef, handsLowTimerRef, noGesturesTimerRef);

            // Save statuses for sidebar
            nextMoveStatus = moveRes.status;
            nextHandStatus = handsRes.status;

            // 2. Main Screen Priority System
            const timeSinceStart = sessionStartTimeRef.current ? (now - sessionStartTimeRef.current) : 0;
            
            // A. Distance check - first 5 seconds only
            if (timeSinceStart < 5000 && !distRes.isGood) {
                candidateOverlay = distRes.status;
            }
            // B. Critical Errors (Always Top Priority)
            else if (!postureRes.isGood) candidateOverlay = postureRes.status;
            else if (!handsRes.isGood && handsRes.status.includes("Touch")) candidateOverlay = handsRes.status;
            else if (!headRes.isGood) candidateOverlay = headRes.status;
            else if (!scanRes.isGood) candidateOverlay = scanRes.status;
            
            // C. Positive Reinforcement - only after 10s warmup
            else if (timeSinceStart > 10000) {
                if (scanRes.status.includes("Great")) candidateOverlay = scanRes.status;
                else if (moveRes.status.includes("Dynamic")) candidateOverlay = moveRes.status;
                else if (handsRes.status.includes("Power")) candidateOverlay = handsRes.status;
            }
        }

        // --- Step 2: Sidebar Update ---
        if (now - lastSidebarUpdateRef.current > 1000) {
            if (stageMovementStatus !== nextMoveStatus) setStageMovementStatus(nextMoveStatus);
            if (handsActivityStatus !== nextHandStatus) setHandsActivityStatus(nextHandStatus);
            lastSidebarUpdateRef.current = now;
        }

        // --- Step 3: Main Overlay Update ---
        // cooldown for alerts
        const STRICT_COOLDOWN = 5000; 
        const timePassed = now - lastOverlayUpdateRef.current;

        if (timePassed > STRICT_COOLDOWN) {
            if (postureStatus !== candidateOverlay) {
                setPostureStatus(candidateOverlay);
                lastOverlayUpdateRef.current = now; 
            }
        }
    };

    return {
        postureStatus,       
        stageMovementStatus, 
        handsActivityStatus, 
        processStandingFrame 
    };
};