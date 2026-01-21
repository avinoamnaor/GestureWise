import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card, Button, Badge, ProgressBar, Modal } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useAuth } from '../context/AuthContext';
import { 
    analyzeStandingHeadPose, 
    analyzeStandingPosture, 
    analyzeStageMovement, 
    analyzeHandGestures, 
    analyzeAudienceScanning, 
    analyzeDistance 
} from '../utils/standingAnalysis';

// --- רכיב התראה צפה (Smart Toast) - ללא אימוג'ים ---
const SmartToast = ({ message, type }) => {
    if (!message) return null;
    const colors = { warning: '#ffc107', danger: '#dc3545', success: '#198754' };
    return (
        <div className="position-absolute top-0 start-50 translate-middle-x mt-4 p-3 shadow-lg" 
             style={{ 
                 zIndex: 100, 
                 backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                 borderRadius: '50px', 
                 borderLeft: `5px solid ${colors[type] || '#fff'}`, 
                 backdropFilter: 'blur(5px)', 
                 animation: 'fadeIn 0.3s ease-in-out' 
             }}>
            <h4 className="text-white m-0 fw-bold px-3">
                {message}
            </h4>
        </div>
    );
};

// --- קומפוננטת תצוגה למצב עמידה (ללא אימוג'ים) ---
const StageOverlay = ({ posture, movement, hands }) => {
    if (posture.includes("Step") || posture.includes("Too")) {
        return (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                 style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 20 }}>
                <div className="text-center">
                    <h1 className="text-white fw-bold display-1">{posture}</h1>
                </div>
            </div>
        );
    }
    let message = null; let colorClass = "warning";
    if (hands.includes("Show") || hands.includes("Uncross") || hands.includes("Low") || hands.includes("Touch")) {
        message = hands; colorClass = "warning";
    } else if (movement.includes("Move") || movement.includes("Stop")) {
        message = movement; colorClass = "info";
    } else if (posture.includes("Straighten") || posture.includes("Look Up")) {
        message = posture; colorClass = "warning";
    }
    if (!message) return null;
    return (
        <div className="position-absolute top-50 start-50 translate-middle text-center p-4" 
             style={{ minWidth: '60%', borderRadius: '20px', zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', border: `3px solid ${colorClass === 'warning' ? '#ffc107' : '#0dcaf0'}` }}>
            <h1 className={`fw-bold display-4 m-0 ${colorClass === 'warning' ? 'text-warning' : 'text-info'}`} style={{ textShadow: '2px 2px 4px #000' }}>{message}</h1>
        </div>
    );
};

// --- רכיב מטריקה נקי וקומפקטי במיוחד ---
const DashboardMetric = ({ label, value, subValue }) => {
    const isPositive = (val) => val && (val.includes("Good") || val.includes("Perfect") || val.includes("Centered") || val.includes("Straight") || val.includes("Level") || val.includes("Open") || val.includes("Smiling") || val.includes("Engaged") || val.includes("Balanced") || val.includes("Lighting Good") || val.includes("Great"));
    const isNegative = (val) => val && (val.includes("Too") || val.includes("Don't") || val.includes("Away") || val.includes("Low") || val.includes("High") || val.includes("Uneven") || val.includes("Reading") || val.includes("Tucked") || val.includes("Dark"));
    
    const mainBad = isNegative(value);
    const subBad = subValue ? isNegative(subValue) : false;
    const mainGood = isPositive(value);
    
    const borderColor = (mainBad || subBad) ? '#dc3545' : (mainGood ? '#198754' : '#6c757d');
    const textColor = (mainBad || subBad) ? 'text-danger' : (mainGood ? 'text-success' : 'text-dark');

    return (
        // שימוש ב-p-1 לחיסכון במקום
        <div className="bg-light p-1 mb-1 rounded-3 shadow-sm border-start border-4" style={{ borderColor: borderColor, minHeight: '42px', display: 'flex', alignItems: 'center' }}>
            <div className="flex-grow-1 ps-2" style={{ lineHeight: '1' }}>
                <h6 className="text-muted text-uppercase fw-bold m-0" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>{label}</h6>
                <div className={`fw-bold ${textColor}`} style={{ fontSize: '0.95rem' }}>{value}</div>
                {subValue && <div className={`fw-bold ${isNegative(subValue) ? 'text-danger' : 'text-muted'}`} style={{ fontSize: '0.75rem' }}>{subValue}</div>}
            </div>
        </div>
    );
};

// --- Helper Functions ---
const calculateVariance = (arr) => {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
};

const BRIGHTNESS_THRESHOLD = 30; 
const SHOULDER_WIDTH_MIN = 0.25; 
const SHOULDER_WIDTH_MAX = 0.65; 

// --- פונקציות ניתוח (ללא אימוג'ים) ---
const analyzeLighting = (videoElement) => {
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

const analyzeEyeContact = (blendshapes) => {
    if (!blendshapes) return { status: "No Face", isGood: false };
    const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;
    
    if (getScore('eyeBlinkLeft') > 0.5 || getScore('eyeBlinkRight') > 0.5) return { status: "Blinking", isGood: true };
    
    const gazeX = getScore('eyeLookInLeft') - getScore('eyeLookOutLeft'); 
    const gazeY = getScore('eyeLookUpLeft') - getScore('eyeLookDownLeft');
    
    if (Math.abs(gazeX) > 0.5 || Math.abs(gazeY) > 0.5) return { status: "Looking Away", isGood: false };
    
    return { status: "Good Contact", isGood: true };
};

const analyzeHeadTilt = (landmarks) => {
    const angle = Math.atan2(landmarks[263].y - landmarks[33].y, landmarks[263].x - landmarks[33].x) * (180 / Math.PI);
    if (Math.abs(angle) < 8) return "Straight";
    if (Math.abs(angle) < 20) return "Slight Tilt";
    return "Too Tilted";
};

const analyzeCameraHeight = (faceLandmarks) => {
    const avgEyeY = (faceLandmarks[33].y + faceLandmarks[263].y) / 2;
    if (avgEyeY < 0.25) return "Camera Too Low";
    if (avgEyeY > 0.55) return "Camera Too High";
    return "Height Perfect";
};

const analyzeChinPitch = (landmarks) => {
    const noseToEyeDist = landmarks[1].y - ((landmarks[33].y + landmarks[263].y) / 2);
    if (noseToEyeDist < 0.055) return "Chin Too High";
    if (noseToEyeDist > 0.12) return "Chin Tucked"; 
    return "Chin Level";
};

const analyzeShoulderStability = (poseLandmarks) => {
    if(!poseLandmarks[11] || !poseLandmarks[12]) return { status: "No Shoulders", isLevel: false };
    if (Math.abs(poseLandmarks[11].y - poseLandmarks[12].y) > 0.04) return { status: "Uneven Shoulders", isLevel: false };
    return { status: "Posture Great", isLevel: true };
  };

const analyzeBodyAndHands = (poseLandmarks, faceLandmarks) => {
    if (!poseLandmarks) return { status: "No Body", isGood: false };
    if (!faceLandmarks) return { status: "Hands Open", isGood: true };
    const xs = faceLandmarks.map(p => p.x); const ys = faceLandmarks.map(p => p.y);
    const pad = 0.05; 
    const faceBox = { minX: Math.min(...xs)-pad, maxX: Math.max(...xs)+pad, minY: Math.min(...ys)-pad, maxY: Math.max(...ys)+pad };
    const checkPoints = [15, 17, 19, 21, 16, 18, 20, 22];
    let isTouching = false;
    for (let i = 0; i < checkPoints.length; i++) {
        const point = poseLandmarks[checkPoints[i]];
        if (point && point.visibility > 0.3 && point.x >= faceBox.minX && point.x <= faceBox.maxX && point.y >= faceBox.minY && point.y <= faceBox.maxY) {
            isTouching = true; break;
        }
    }
    if (isTouching) return { status: "Don't touch face", isGood: false };
    if (!(poseLandmarks[15].visibility > 0.5 || poseLandmarks[16].visibility > 0.5)) return { status: "Hands Hidden", isGood: true };
    return { status: "Hands Open", isGood: true };
};

const analyzeCenteringAndDistance = (faceLandmarks, poseLandmarks) => {
    const nose = faceLandmarks[1];
    let centerStatus = "Centered"; let isCentered = true;
    if (nose.x < 0.4) { centerStatus = "Move Left"; isCentered = false; } 
    else if (nose.x > 0.6) { centerStatus = "Move Right"; isCentered = false; }
    let distStatus = "Distance Perfect";
    if (poseLandmarks) {
        const width = Math.abs(poseLandmarks[11].x - poseLandmarks[12].x);
        if (width < SHOULDER_WIDTH_MIN) distStatus = "Too Far"; else if (width > SHOULDER_WIDTH_MAX) distStatus = "Too Close";
    }
    return { centerStatus, isCentered, distStatus };
};

const analyzeEngagement = (poseLandmarks) => {
    const width = Math.abs(poseLandmarks[11].x - poseLandmarks[12].x);
    if (width > 0.55) return "Leaning In";
    if (width < 0.30) return "Leaning Back";
    return "Balanced Posture";
};

const analyzeExpression = (blendshapes) => {
    const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;
    const smile = (getScore('mouthSmileLeft') + getScore('mouthSmileRight')) / 2;
    let smileStat = { status: "Neutral", isSmiling: false };
    if (smile > 0.4) smileStat = { status: "Smiling", isSmiling: true };
    
    const browUp = (getScore('browOuterUpLeft') + getScore('browOuterUpRight') + getScore('browInnerUp')) / 3;
    let browStat = browUp > 0.45 ? "High Energy" : (browUp > 0.2 ? "Expressive" : "Neutral");
    const squint = (getScore('eyeSquintLeft') + getScore('eyeSquintRight')) / 2;
    let squintStat = squint > 0.6 ? "Squinting" : "Eyes Open";
    return { smile: smileStat, brow: browStat, squint: squintStat };
};

function PracticePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { speechText, speechTitle } = location.state || {};
  
  const [practiceMode, setPracticeMode] = useState(null); 
  const [showModeSelector, setShowModeSelector] = useState(true); 

  const [isSetupPhase, setIsSetupPhase] = useState(true);

  const scoreRef = useRef(100); 
  const [liveScore, setLiveScore] = useState(100); 
  const [smartFeedback, setSmartFeedback] = useState(null); 
  
  const engagementStabilityTimer = useRef(0); // סופר כמה זמן אנחנו במצב החדש
  const lastEngagementCandidate = useRef("Balanced"); // המצב החדש שאנחנו בודקים
  const [displayedEngagement, setDisplayedEngagement] = useState("Balanced"); // מה שמוצג בפועל למשתמש
  
  const eyeStabilityRef = useRef(0);
  const centerStabilityRef = useRef(0);
  const handsStabilityRef = useRef(0);
  const chinStabilityRef = useRef(0);      
  const headTiltStabilityRef = useRef(0);  
  const shoulderStabilityRef = useRef(0);
  const lowVolumeTimerRef = useRef(0); 
  
  const lastDetectedTiltRef = useRef("Straight");   
  const lastBadChinRef = useRef("Chin Level"); 
  const lastShoulderStatusRef = useRef("Posture Great");
  const gazeHistoryRef = useRef([]);

  const sessionStatsRef = useRef({
      eyesBadFrames: 0,
      centerBadFrames: 0,
      handsBadFrames: 0,
      totalFrames: 0,
      goodVolumeFrames: 0,
      smilingFrames: 0
  });

  const [showTeleprompter, setShowTeleprompter] = useState(!!speechText);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30); 
  const [isHoveringPrompter, setIsHoveringPrompter] = useState(false);
  const prompterRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const movementHistoryRef = useRef([]); 
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

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  
  const [error, setError] = useState(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  
  const [centeringStatus, setCenteringStatus] = useState("Centered"); 
  const [expressionStatus, setExpressionStatus] = useState("Neutral"); 
  const [browStatus, setBrowStatus] = useState("Neutral"); 
  const [headTiltStatus, setHeadTiltStatus] = useState("Straight");
  const [cameraHeightStatus, setCameraHeightStatus] = useState("Checking...");
  const [shoulderStatus, setShoulderStatus] = useState("Checking...");
  const [squintStatus, setSquintStatus] = useState("Eyes Open");
  const [chinStatus, setChinStatus] = useState("Checking...");
  const [eyeContactStatus, setEyeContactStatus] = useState("Good Contact"); 
  const [bodyStatus, setBodyStatus] = useState("Hands Open"); 
  const [lightingStatus, setLightingStatus] = useState("Checking..."); 
  const [distanceStatus, setDistanceStatus] = useState("Checking...");
  const [engagementStatus, setEngagementStatus] = useState("Balanced"); 
  
  const [volumeLevel, setVolumeLevel] = useState(0); 

  const [stageMovementStatus, setStageMovementStatus] = useState("Stand Still"); 
  const [postureStatus, setPostureStatus] = useState("Checking..."); 
  const [handsActivityStatus, setHandsActivityStatus] = useState("Inactive"); 

  const faceLandmarkerRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const requestRef = useRef(null);
  const lastProcessTimeRef = useRef(0);
  
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    let intervalId;
    if (isScrolling && !isHoveringPrompter && prompterRef.current) {
        const delay = 150 - (scrollSpeed * 1.4); 
        intervalId = setInterval(() => {
            if (prompterRef.current) prompterRef.current.scrollTop += 1; 
        }, Math.max(10, delay));
    }
    return () => clearInterval(intervalId);
  }, [isScrolling, isHoveringPrompter, scrollSpeed]);

  useEffect(() => {
    const createLandmarkers = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, delegate: "GPU" },
          outputFaceBlendshapes: true, runningMode: "VIDEO", numFaces: 1
        });
        poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`, delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1
        });
        setIsModelsLoaded(true);
      } catch (err) { setError("Failed to load AI models."); }
    };
    createLandmarkers();

    const startMedia = async () => {
      try {
        const constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) videoRef.current.srcObject = stream;
        startRecording(stream);
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      } catch (err) { setError("Could not access camera/microphone."); }
    };
    startMedia();

    return () => {
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // --- טיימר: 15 שניות ---
  useEffect(() => {
    if (isModelsLoaded && practiceMode === 'sitting') {
        const timer = setTimeout(() => {
            setIsSetupPhase(false);
        }, 10000); 
        return () => clearTimeout(timer);
    }
  }, [isModelsLoaded, practiceMode]);

  useEffect(() => {
    if (isModelsLoaded && practiceMode) {
        predictWebcam();
    }
  }, [isModelsLoaded, practiceMode]);

  const startRecording = (stream) => {
    try {
      recordedChunksRef.current = []; 
      const options = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? { mimeType: "video/webm;codecs=vp9" } : { mimeType: "video/webm" };
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) { console.error("Recording failed to start", err); }
  };

  const analyzeAudio = () => {
    if (!analyserRef.current || !dataArrayRef.current) return { vol: 0 };
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const avg = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length;
    
    // הורדנו טיפה את הרף התחתון (מ-15 ל-10) כדי שיקלוט גם דיבור שקט
    const NOISE_FLOOR = 10; 
    
    // השינוי הגדול: הגדלנו את המכפיל מ-1.2 ל-4.0
    // זה ה"ווליום" של המד - ככל שהמספר גבוה יותר, הבר יתמלא יותר בקלות
    let rawVolume = avg > NOISE_FLOOR ? (avg - NOISE_FLOOR) * 2.0 : 0;
    
    let volume = Math.min(100, Math.round(rawVolume));
    setVolumeLevel(volume);
    return { vol: volume };
  };

  /*const drawFaceBox = (ctx, faceLandmarks, isTouching) => {
      if (!faceLandmarks) return;
      const xs = faceLandmarks.map(p => p.x); const ys = faceLandmarks.map(p => p.y); 
      const pad = 0.05; 
      const minX = Math.min(...xs) - pad; const maxX = Math.max(...xs) + pad;
      const minY = Math.min(...ys) - pad; const maxY = Math.max(...ys) + pad;
      const width = maxX - minX; const height = maxY - minY;
      ctx.beginPath(); ctx.lineWidth = 3;
      ctx.strokeStyle = isTouching ? "rgba(255, 0, 0, 0.9)" : "rgba(255, 235, 59, 0.5)"; 
      ctx.rect(minX * ctx.canvas.width, minY * ctx.canvas.height, width * ctx.canvas.width, height * ctx.canvas.height);
      ctx.stroke();
  };

  const drawHands = (ctx, poseLandmarks, isTouching) => {
      const drawHandConnections = (indices, color) => {
          ctx.strokeStyle = color; ctx.lineWidth = isTouching ? 5 : 3; ctx.beginPath();
          const p0 = poseLandmarks[indices[0]];
          if(p0 && p0.visibility > 0.3) { 
            ctx.moveTo(p0.x * ctx.canvas.width, p0.y * ctx.canvas.height);
            for (let i = 1; i < indices.length; i++) {
                const p = poseLandmarks[indices[i]];
                if (p && p.visibility > 0.3) ctx.lineTo(p.x * ctx.canvas.width, p.y * ctx.canvas.height);
            }
            ctx.stroke(); ctx.fillStyle = color;
            indices.forEach(idx => { if(poseLandmarks[idx]?.visibility > 0.3) { ctx.beginPath(); ctx.arc(poseLandmarks[idx].x * ctx.canvas.width, poseLandmarks[idx].y * ctx.canvas.height, 4, 0, 2 * Math.PI); ctx.fill(); } });
          }
      };
      drawHandConnections([15, 17, 19, 21], isTouching ? "red" : "#00ff00");
      drawHandConnections([16, 18, 20, 22], isTouching ? "red" : "#00ff00");
  }; */

  const predictWebcam = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && faceLandmarkerRef.current && poseLandmarkerRef.current && video.readyState >= 2) {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d"); 
        let startTimeMs = performance.now();
        const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
        const poseResult = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const faceLms = faceResult.faceLandmarks?.[0];
        const poseLms = poseResult.landmarks?.[0];

        if (practiceMode === 'sitting') {
            const isTouchingFaceForDrawing = handsStabilityRef.current > 20;

            if (Date.now() - lastProcessTimeRef.current > 50) { 
                sessionStatsRef.current.totalFrames++;
                let isFramePerfect = true; 
                let alertMessage = null;

                const lightRes = analyzeLighting(video); 
                setLightingStatus(lightRes.status);
                const audioRes = analyzeAudio(); 
                if (audioRes.vol > 20) sessionStatsRef.current.goodVolumeFrames++;

                if (audioRes.vol < 10) {
                    lowVolumeTimerRef.current++;
                } else {
                    lowVolumeTimerRef.current = 0;
                }

                if (lowVolumeTimerRef.current > 160) {
                    isFramePerfect = false;
                    if ((lowVolumeTimerRef.current - 160) % 200 === 0) {
                        scoreRef.current = Math.max(0, scoreRef.current - 2); 
                        alertMessage = { text: "דבר בקול רם!", type: "warning" };
                    }
                }

                let eyeRes = { status: "No Face", isGood: false };
                let posRes = { centerStatus: "No Face", isCentered: false };
                let bodyRes = { status: "No Body", isGood: false };

                if (faceResult.faceBlendshapes?.[0]) {
                    eyeRes = analyzeEyeContact(faceResult.faceBlendshapes[0].categories);
                    
                    if (!eyeRes.isGood) {
                        eyeStabilityRef.current += 1;
                    } else {
                        eyeStabilityRef.current = Math.max(0, eyeStabilityRef.current - 2);
                    }

                    if (eyeStabilityRef.current > 15) {
                        setEyeContactStatus("Looking Away");
                    } else {
                        setEyeContactStatus(eyeRes.status === "Reading Text" ? "Reading Text" : "Good Contact");
                    }

                    if (eyeStabilityRef.current > 40) { 
                        isFramePerfect = false;
                        if ((eyeStabilityRef.current - 40) % 40 === 0) {
                            scoreRef.current = Math.max(0, scoreRef.current - 3); 
                            sessionStatsRef.current.eyesBadFrames += 40; 
                            alertMessage = { text: "שמור על קשר עין", type: "warning" };
                        }
                    } 

                    const exprRes = analyzeExpression(faceResult.faceBlendshapes[0].categories);
                    if(exprRes.smile.isSmiling) {
                         sessionStatsRef.current.smilingFrames++;
                         setExpressionStatus(exprRes.smile.status);
                    } else setExpressionStatus("Neutral");
                    setBrowStatus(exprRes.brow);
                    setSquintStatus(exprRes.squint);
                }

                if (poseLms && faceLms) {
                    bodyRes = analyzeBodyAndHands(poseLms, faceLms);
                    
                    if (!bodyRes.isGood) {
                        handsStabilityRef.current += 1;
                    } else {
                        handsStabilityRef.current = Math.max(0, handsStabilityRef.current - 2);
                    }

                    if (handsStabilityRef.current > 15) {
                        setBodyStatus("Don't touch face");
                    } else {
                        setBodyStatus("Hands Open");
                    }

                    if (handsStabilityRef.current > 30) { 
                        isFramePerfect = false;
                        if ((handsStabilityRef.current - 30) % 30 === 0) {
                            scoreRef.current = Math.max(0, scoreRef.current - 5); 
                            sessionStatsRef.current.handsBadFrames += 30;
                            alertMessage = { text: "הרחק ידיים מהפנים", type: "danger" };
                        }
                    }

                    const shoulderRes = analyzeShoulderStability(poseLms);
                    if (!shoulderRes.isLevel) shoulderStabilityRef.current++;
                    else shoulderStabilityRef.current = Math.max(0, shoulderStabilityRef.current - 2);
                    
                    if (shoulderStabilityRef.current > 45) {
                        setShoulderStatus("Uneven Shoulders");
                        lastShoulderStatusRef.current = "Uneven Shoulders";
                    } else if (shoulderStabilityRef.current === 0) {
                        setShoulderStatus("Posture Great");
                        lastShoulderStatusRef.current = "Posture Great";
                    } else {
                        setShoulderStatus(lastShoulderStatusRef.current);
                    }

                    if (shoulderStabilityRef.current > 60) {
                        isFramePerfect = false;
                        if ((shoulderStabilityRef.current - 60) % 90 === 0) {
                            scoreRef.current = Math.max(0, scoreRef.current - 5);
                            alertMessage = { text: "ישר את הכתפיים", type: "warning" };
                        }
                    }
                }

                if (faceLms) {
                    posRes = analyzeCenteringAndDistance(faceLms, poseLms);
                    
                    if (!posRes.isCentered) {
                        centerStabilityRef.current += 1;
                    } else {
                        centerStabilityRef.current = 0;
                    }

                    if (centerStabilityRef.current > 20) {
                        setCenteringStatus(posRes.centerStatus);
                    } else {
                        setCenteringStatus("Centered");
                    }

                    if (centerStabilityRef.current > 40) { 
                        isFramePerfect = false;
                        if ((centerStabilityRef.current - 40) % 40 === 0) {
                            scoreRef.current = Math.max(0, scoreRef.current - 4);
                            sessionStatsRef.current.centerBadFrames += 40;
                            alertMessage = { text: posRes.centerStatus, type: "warning" };
                        }
                    }

                    setDistanceStatus(posRes.distStatus);
                    
                    const rawTilt = analyzeHeadTilt(faceLms);
                    if (rawTilt.includes("Too Tilted")) headTiltStabilityRef.current++;
                    else headTiltStabilityRef.current = Math.max(0, headTiltStabilityRef.current - 2);

                    if (headTiltStabilityRef.current > 45) {
                        setHeadTiltStatus(rawTilt);
                        lastDetectedTiltRef.current = rawTilt;
                    } else if (headTiltStabilityRef.current === 0) {
                        setHeadTiltStatus("Straight");
                    } else {
                        setHeadTiltStatus(lastDetectedTiltRef.current);
                    }

                    if (headTiltStabilityRef.current > 60) {
                        isFramePerfect = false;
                        if ((headTiltStabilityRef.current - 60) % 90 === 0) {
                            scoreRef.current = Math.max(0, scoreRef.current - 5);
                            alertMessage = { text: "ישר את הראש", type: "warning" };
                        }
                    }

                    const rawChin = analyzeChinPitch(faceLms);
                    if (rawChin.includes("Too") || rawChin.includes("Tucked")) chinStabilityRef.current++;
                    else chinStabilityRef.current = Math.max(0, chinStabilityRef.current - 2);

                    if (chinStabilityRef.current > 45) {
                        setChinStatus(rawChin);
                        lastBadChinRef.current = rawChin;
                    } else if (chinStabilityRef.current === 0) {
                        setChinStatus("Chin Level");
                    } else {
                        setChinStatus(lastBadChinRef.current);
                    }

                    if (chinStabilityRef.current > 60) {
                         isFramePerfect = false;
                         if ((chinStabilityRef.current - 60) % 90 === 0) {
                             scoreRef.current = Math.max(0, scoreRef.current - 5);
                             alertMessage = { text: "הרם את הראש", type: "warning" };
                         }
                    }

                    const rawCam = analyzeCameraHeight(faceLms);
                    setCameraHeightStatus(rawCam);
                    // --- ייצוב Engagement (Relaxed / Leaning) ---
                    if (poseLms) {
                        const currentRawEngagement = analyzeEngagement(poseLms);
                        
                        // אם המצב שונה ממה שמוצג כרגע
                        if (currentRawEngagement !== displayedEngagement) {
                            // האם זה אותו מצב כמו בפריים הקודם? (כלומר, אנחנו ברצף של שינוי)
                            if (currentRawEngagement === lastEngagementCandidate.current) {
                                engagementStabilityTimer.current++;
                            } else {
                                // התחלנו רצף חדש של מצב אחר
                                engagementStabilityTimer.current = 0;
                                lastEngagementCandidate.current = currentRawEngagement;
                            }

                            // סף השינוי: רק אחרי 20 פריימים רצופים (כ-0.7 שניות) נעדכן את התצוגה
                            if (engagementStabilityTimer.current > 20) {
                                setDisplayedEngagement(currentRawEngagement);
                                // (אופציונלי) כאן אפשר לעדכן גם את הסטייט המקורי אם משתמשים בו במקומות אחרים
                                setEngagementStatus(currentRawEngagement); 
                                engagementStabilityTimer.current = 0;
                            }
                        } else {
                            // אם המצב חזר להיות כמו המוצג, נאפס את הטיימר
                            engagementStabilityTimer.current = 0;
                        }
                    }
                }

                if (isFramePerfect) {
                    scoreRef.current = Math.min(100, scoreRef.current + 0.01);
                }

                if (alertMessage) {
                    setSmartFeedback(alertMessage);
                    setTimeout(() => setSmartFeedback(null), 3000);
                }

                if (Math.round(scoreRef.current) !== liveScore) {
                    setLiveScore(Math.round(scoreRef.current));
                }
                
                lastProcessTimeRef.current = Date.now();
            }
            if (faceLms) drawFaceBox(ctx, faceLms, isTouchingFaceForDrawing);
            if (poseLms) drawHands(ctx, poseLms, isTouchingFaceForDrawing);
        } 
        
        else if (practiceMode === 'standing') {
            if (Date.now() - lastProcessTimeRef.current > 100) {
                if (poseLms) {
                    const distRes = analyzeDistance(poseLms, faceLms);
                    const postureRes = analyzeStandingPosture(poseLms, leaningTimerRef, bodyTurnTimerRef);
                    const headRes = analyzeStandingHeadPose(poseLms, headDownTimerRef);
                    const scanRes = analyzeAudienceScanning(poseLms, scanningTimerRef);
                    const moveRes = analyzeStageMovement(poseLms, movementHistoryRef.current, staticTimerRef, dynamicFeedbackTimerRef);
                    const handsRes = analyzeHandGestures(poseLms, crossedArmsTimerRef, faceTouchTimerRef, figLeafTimerRef, handsLowTimerRef, noGesturesTimerRef);

                    let finalHeadStatus = "Good Posture ✅"; 
                    if (!distRes.isGood) finalHeadStatus = distRes.status;
                    else if (!postureRes.isGood) finalHeadStatus = postureRes.status;
                    else if (!headRes.isGood) finalHeadStatus = headRes.status;
                    else if (!scanRes.isGood) finalHeadStatus = scanRes.status;
                    else if (scanRes.status.includes("Great")) finalHeadStatus = scanRes.status;
                    else if (headRes.status.includes("Glancing")) finalHeadStatus = headRes.status;

                    setPostureStatus(finalHeadStatus);
                    setStageMovementStatus(moveRes.status);
                    setHandsActivityStatus(handsRes.status);
                } else setPostureStatus("Body not detected ❌");
                lastProcessTimeRef.current = Date.now();
            }
            if (poseLms) drawHands(ctx, poseLms, false);
        }
      }
    }
    if (practiceMode) requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const handleStopSession = async () => {
    setIsSaving(true);
    let videoBlob = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
       await new Promise((resolve) => {
          mediaRecorderRef.current.onstop = () => { 
              videoBlob = new Blob(recordedChunksRef.current, { type: "video/webm" }); 
              resolve(); 
          };
          mediaRecorderRef.current.stop();
       });
    }

    const durationSeconds = (Date.now() - startTimeRef.current) / 1000;
    const formattedDuration = `${Math.floor(durationSeconds / 60)}:${Math.floor(durationSeconds % 60) < 10 ? '0' : ''}${Math.floor(durationSeconds % 60)}`;
    
    const total = Math.max(1, sessionStatsRef.current.totalFrames);
    const calcMetric = (badFrames) => Math.max(0, Math.round(100 - (badFrames / total * 100)));

    const speechTimeRatio = sessionStatsRef.current.goodVolumeFrames / total;
    const volumeScore = Math.min(100, Math.round((speechTimeRatio / 0.15) * 100));

    const scores = {
        eyeContact: calcMetric(sessionStatsRef.current.eyesBadFrames),
        centering: calcMetric(sessionStatsRef.current.centerBadFrames),
        hands: calcMetric(sessionStatsRef.current.handsBadFrames),
        expression: Math.round((sessionStatsRef.current.smilingFrames / total) * 100),
        volume: volumeScore,
        posture: calcMetric(sessionStatsRef.current.centerBadFrames), 
        articulation: 100
    };
    
    const sessionData = {
        userId: user ? user.id : "Guest", 
        speechTitle: speechTitle || "Free Practice",
        practiceMode: practiceMode || 'sitting',
        date: new Date(),
        duration: formattedDuration,
        overallScore: liveScore, 
        metrics: scores,
    };
    
    navigate('/summary', { state: { realData: sessionData, videoBlob: videoBlob } });
    setIsSaving(false);
  };

  const handleModeSelect = (mode) => { setPracticeMode(mode); setShowModeSelector(false); };

  return (
    <div style={{ height: 'calc(100vh - 80px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Modal show={showModeSelector} centered backdrop="static" keyboard={false} size="lg">
        <Modal.Header><Modal.Title className="fw-bold">Choose Your Practice Mode</Modal.Title></Modal.Header>
        <Modal.Body className="p-5 text-center">
            <h5 className="mb-4">How are you presenting today?</h5>
            <Row className="g-4">
                <Col md={6}>
                    <Card className="h-100 shadow-sm hover-effect border-2" role="button" onClick={() => handleModeSelect('sitting')} style={{ cursor: 'pointer', transition: '0.2s', borderColor: '#0d6efd' }}>
                        <Card.Body className="py-5"><div style={{ fontSize: '4rem', marginBottom: '15px' }}>💻</div><h4>Online / Webcam</h4><p className="text-muted small">Focus on: Eye contact, facial expressions, and clarity.<br/>Best for: Zoom calls, Interviews.</p><Button variant="outline-primary" className="mt-3">Select Sitting</Button></Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="h-100 shadow-sm hover-effect border-2" role="button" onClick={() => handleModeSelect('standing')} style={{ cursor: 'pointer', transition: '0.2s', borderColor: '#198754' }}>
                        <Card.Body className="py-5"><div style={{ fontSize: '4rem', marginBottom: '15px' }}>🎤</div><h4>Stage / Standing</h4><p className="text-muted small">Focus on: Body language, stage movement, and hand gestures.<br/>Best for: Keynotes, Class presentations.</p><Button variant="outline-success" className="mt-3">Select Standing</Button></Card.Body>
                    </Card>
                </Col>
            </Row>
        </Modal.Body>
      </Modal>

      <div className="bg-white border-bottom px-4 py-2 d-flex justify-content-between align-items-center" style={{ flexShrink: 0 }}>
        <div>
            <h5 className="m-0 font-weight-bold">
                Live Practice 
                {practiceMode === 'standing' && <Badge bg="success" className="ms-2">Stage Mode</Badge>}
                {practiceMode === 'sitting' && <Badge bg="primary" className="ms-2">Webcam Mode</Badge>}
            </h5>
            <small className={isModelsLoaded ? "text-success" : "text-warning"}>{isModelsLoaded ? "AI Active & Ready" : "Loading Models..."}</small>
        </div>
        
        <div className="d-flex align-items-center gap-2">
            {speechText && (
              <Button variant="outline-primary" size="sm" onClick={() => setShowTeleprompter(!showTeleprompter)} style={{ borderRadius: '20px', padding: '5px 15px' }}>
                {showTeleprompter ? "Hide Script" : "Show Script"}
              </Button>
            )}
            <Button variant={isSaving ? "secondary" : "outline-danger"} size="sm" onClick={handleStopSession} disabled={isSaving} style={{ borderRadius: '20px', padding: '5px 20px' }}>
              {isSaving ? "Saving..." : "Stop"}
            </Button>
        </div>
      </div>

      <div className="flex-grow-1 p-3" style={{ overflow: 'hidden', backgroundColor: '#f4f4f4' }}>
        <Container fluid style={{ height: '100%' }}>
          <Row style={{ height: '100%' }}>
            <Col lg={9} className="h-100 pb-2">
              <Card className="h-100 shadow-sm border-0 position-relative" style={{ borderRadius: '20px', overflow: 'hidden', backgroundColor: '#2c3e50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="position-absolute top-0 start-0 m-3 z-index-10"><Badge bg="danger">LIVE REC</Badge></div>
                
                {/* --- חיוויים חכמים --- */}
                {practiceMode === 'sitting' && <SmartToast message={smartFeedback?.text} type={smartFeedback?.type} />}
                
                {practiceMode === 'standing' && ( <StageOverlay posture={postureStatus} movement={stageMovementStatus} hands={handsActivityStatus} /> )}

                {error && <div className="text-white p-3">{error}</div>}
                
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }} />
                  <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)', pointerEvents: 'none' }} />
                  
                  {/* --- Floating Volume HUD (עיצוב אלגנטי וצדדי) --- */}
                  {practiceMode === 'sitting' && (
                      <div className="position-absolute bottom-0 end-0 m-3 px-3 py-2 shadow-sm" 
                           style={{ 
                               zIndex: 20, 
                               backgroundColor: 'rgba(255, 255, 255, 0.75)', // שקיפות גבוהה יותר
                               backdropFilter: 'blur(5px)', // אפקט טשטוש רקע (Glassmorphism)
                               borderRadius: '20px', 
                               display: 'flex', 
                               alignItems: 'center', 
                               gap: '10px',
                               minWidth: '140px', // קומפקטי יותר
                               maxWidth: '180px',
                               border: '1px solid rgba(255,255,255,0.4)',
                               transition: 'all 0.3s ease'
                           }}>
                          
                          {/* אייקון קטן ונקי */}
                          <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                              {volumeLevel < 5 ? '🔇' : '🎙️'}
                          </span>
                          
                          {/* הבר והטקסט */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div className="d-flex justify-content-between align-items-center">
                                  {/* טקסט מינימליסטי */}
                                  <small className="fw-bold text-secondary" style={{ fontSize: '0.55rem', letterSpacing: '0.5px' }}>
                                      {volumeLevel < 10 ? "LOW" : "ACTIVE"}
                                  </small>
                                  <small className="fw-bold text-dark" style={{ fontSize: '0.6rem' }}>{volumeLevel}%</small>
                              </div>
                              <ProgressBar 
                                  now={volumeLevel} 
                                  variant={volumeLevel > 75 ? "danger" : (volumeLevel < 10 ? "warning" : "success")} 
                                  style={{ height: '4px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.1)' }} 
                              />
                          </div>
                      </div>
                  )}

                  {speechText && showTeleprompter && (
                    <div className="position-absolute top-0 start-50 translate-middle-x mt-3 d-flex align-items-start gap-3" style={{ width: '80%', zIndex: 100 }}>
                        <div 
                            ref={prompterRef}
                            onMouseEnter={() => setIsHoveringPrompter(true)}
                            onMouseLeave={() => setIsHoveringPrompter(false)}
                            className="bg-dark text-white p-3 text-center shadow-lg"
                            style={{
                                flex: 1, maxHeight: '20vh', overflowY: 'auto', borderRadius: '15px', fontSize: '1.2rem', lineHeight: '1.6', opacity: 0.7, backdropFilter: 'blur(5px)', scrollBehavior: 'smooth'
                            }}
                        >
                            <h5 className="text-muted mb-2 fs-6">{speechTitle}</h5>
                            {speechText}
                            <div style={{ height: '100px' }}></div> 
                        </div>
                        <div className="d-flex flex-column gap-2 bg-white p-2 rounded shadow-sm opacity-75 align-items-center">
                            <Button variant={isScrolling ? "warning" : "success"} size="sm" className="rounded-circle d-flex align-items-center justify-content-center p-0" style={{ width: '35px', height: '35px' }} onClick={() => setIsScrolling(!isScrolling)}>{isScrolling ? "⏸" : "▶"}</Button>
                            <div className="d-flex flex-column align-items-center"><small className="text-muted fw-bold" style={{fontSize: '0.6rem'}}>SPD</small><input type="range" min="1" max="100" value={scrollSpeed} onChange={(e) => setScrollSpeed(Number(e.target.value))} style={{ width: '60px', cursor: 'pointer' }} /></div>
                        </div>
                    </div>
                  )}
                </div>
              </Card>
            </Col>

            <Col lg={3} className="h-100 pb-2">
              <Card className="h-100 border-0 shadow-sm bg-white" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                <Card.Header className="bg-transparent border-0 pt-3 px-3 pb-1 flex-shrink-0">
                    <div className="d-flex justify-content-between align-items-center">
                        <h6 className="font-weight-bold m-0" style={{ color: '#333', fontSize: '0.9rem' }}>
                            {isSetupPhase ? "ENVIRONMENT CHECK" : "LIVE ANALYSIS"}
                        </h6>
                        {isSetupPhase && <Badge bg="warning" className="text-dark" style={{fontSize: '0.6rem'}}>Setup</Badge>}
                    </div>
                </Card.Header>
                
                {practiceMode === 'sitting' && (
                <Card.Body className="d-flex flex-column px-2 pb-2 pt-0 gap-2" style={{ height: '100%', overflow: 'hidden' }}>
                  
                  {/* 1. ציון - קבוע למעלה, גודל מוקטן */}
                  <div className="text-center p-1 bg-light border rounded flex-shrink-0">
                      <small className="text-muted fw-bold" style={{ fontSize: '0.65rem' }}>LIVE SCORE</small>
                      <div style={{ fontSize: '2.2rem', fontWeight: '800', lineHeight: 1, color: liveScore > 80 ? '#28a745' : (liveScore > 60 ? '#ffc107' : '#dc3545') }}>
                          {liveScore}
                      </div>
                  </div>

                  {/* 2. אזור המדדים - מתגמש ותופס את המקום הפנוי */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden', justifyContent: 'space-evenly' }}>
                      
                      {isSetupPhase && (
                        <>
                            <DashboardMetric label="Lighting" value={lightingStatus} />
                            <DashboardMetric label="Distance" value={distanceStatus} />
                            <DashboardMetric label="Camera Height" value={cameraHeightStatus} />
                        </>
                      )}

                      {!isSetupPhase && (
                        <>
                            <DashboardMetric label="EYES" value={eyeContactStatus} />
                            <DashboardMetric label="HEAD & FACE" value={headTiltStatus} subValue={chinStatus} />
                            <DashboardMetric label="SHOULDERS" value={shoulderStatus} />
                            <DashboardMetric label="POSTURE" value={centeringStatus} subValue={displayedEngagement} />
                            <DashboardMetric label="HANDS" value={bodyStatus} />
                        </>
                      )}
                  </div>
                </Card.Body>
                )}

                {/* --- תצוגת מצב עמידה (ללא שינוי) --- */}
                {practiceMode === 'standing' && (
                    <Card.Body className="d-flex flex-column px-4 gap-2">
                         <h6 className="text-muted mb-3">STAGE ANALYSIS</h6>
                         <div className={`p-3 rounded mb-2 text-center border ${postureStatus.includes("Step") ? 'bg-danger text-white' : 'bg-light'}`}><strong className="d-block mb-1">📍 Posture & Position</strong><div className="fs-5 fw-bold">{postureStatus}</div></div>
                         <div className="p-3 bg-light rounded mb-2 text-center border"><strong className="d-block mb-1">🏃 Movement</strong><div className="text-primary fw-bold">{stageMovementStatus}</div></div>
                         <div className="p-3 bg-light rounded mb-2 text-center border"><strong className="d-block mb-1">👐 Hands</strong><div className="text-info fw-bold">{handsActivityStatus}</div></div>
                    </Card.Body>
                )}
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
}

export default PracticePage;