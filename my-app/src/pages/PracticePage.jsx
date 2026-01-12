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

// --- קומפוננטת תצוגה חכמה למצב עמידה ("הבמאי השקט") ---
const StageOverlay = ({ posture, movement, hands }) => {
    
    // 1. קריטי: בדיקת מרחק (חוסם הכל - מסך אדום)
    if (posture.includes("Step") || posture.includes("Too")) {
        return (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                 style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 20 }}>
                <div className="text-center">
                    <div style={{ fontSize: '5rem', marginBottom: '10px' }}>📏</div>
                    <h1 className="text-white fw-bold display-1" style={{ textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                        {posture}
                    </h1>
                </div>
            </div>
        );
    }

    // מכאן והלאה - מציגים רק אם יש בעיה (Warning Mode)
    let message = null;
    let icon = null;
    let colorClass = "warning"; // צהוב כברירת מחדל

    // 2. בדיקת ידיים (עדיפות שנייה)
    if (hands.includes("Show") || hands.includes("Uncross") || hands.includes("Low") || hands.includes("Touch")) {
        message = hands;
        icon = "👐";
        colorClass = "warning";
    }
    // 3. בדיקת תנועה (עדיפות שלישית)
    else if (movement.includes("Move") || movement.includes("Stop")) {
        message = movement;
        icon = "🏃";
        colorClass = "info"; // כחול
    }
    // 4. בדיקת יציבה/ראש (עדיפות רביעית)
    else if (posture.includes("Straighten") || posture.includes("Look Up")) {
        message = posture;
        icon = "👀";
        colorClass = "warning";
    }

    if (!message) return null;

    return (
        <div className="position-absolute top-50 start-50 translate-middle text-center p-4" 
             style={{ 
                 minWidth: '60%',
                 borderRadius: '20px', 
                 zIndex: 10,
                 backgroundColor: 'rgba(0, 0, 0, 0.6)',
                 backdropFilter: 'blur(4px)',
                 border: `3px solid ${colorClass === 'warning' ? '#ffc107' : '#0dcaf0'}`
             }}>
            <div style={{ fontSize: '3rem', marginBottom: '0' }}>{icon}</div>
            <h1 className={`fw-bold display-4 m-0 ${colorClass === 'warning' ? 'text-warning' : 'text-info'}`} 
                style={{ textShadow: '2px 2px 4px #000' }}>
                {message}
            </h1>
        </div>
    );
};

// --- Helper Functions ---
const calculateVariance = (arr) => {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return variance; 
};

const BRIGHTNESS_THRESHOLD = 40; 
const SHOULDER_WIDTH_MIN = 0.25; 
const SHOULDER_WIDTH_MAX = 0.65; 

function PracticePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { speechText, speechTitle } = location.state || {};
  
  // === State למצב האימון ===
  const [practiceMode, setPracticeMode] = useState(null); 
  const [showModeSelector, setShowModeSelector] = useState(true); 

  // --- Teleprompter States ---
  const [showTeleprompter, setShowTeleprompter] = useState(!!speechText);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30); // 1-100
  const [isHoveringPrompter, setIsHoveringPrompter] = useState(false);
  const prompterRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // --- Refs למצב עמידה ---
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
  
  // === Analysis States (ישיבה) ===
  const [centeringStatus, setCenteringStatus] = useState("Checking..."); 
  const [expressionStatus, setExpressionStatus] = useState("Neutral 😐"); 
  const [browStatus, setBrowStatus] = useState("Neutral 😐"); 
  const [headTiltStatus, setHeadTiltStatus] = useState("Straight 😐");
  const [cameraHeightStatus, setCameraHeightStatus] = useState("Checking... 📏");
  const [shoulderStatus, setShoulderStatus] = useState("Checking... 🤷");
  const [squintStatus, setSquintStatus] = useState("Eyes Open 👀");
  const [chinStatus, setChinStatus] = useState("Checking...");

  const [eyeContactStatus, setEyeContactStatus] = useState("Waiting..."); 
  const [bodyStatus, setBodyStatus] = useState("Waiting..."); 
  const [lightingStatus, setLightingStatus] = useState("Checking..."); 
  const [distanceStatus, setDistanceStatus] = useState("Checking...");
  const [articulationStatus, setArticulationStatus] = useState("Silent 😶"); 
  const [engagementStatus, setEngagementStatus] = useState("Balanced 🧘"); 
  
  const [volumeLevel, setVolumeLevel] = useState(0); 
  const [audioStatus, setAudioStatus] = useState("Listening...");

  // === States למצב עמידה ===
  const [stageMovementStatus, setStageMovementStatus] = useState("Stand Still"); 
  const [postureStatus, setPostureStatus] = useState("Checking..."); 
  const [handsActivityStatus, setHandsActivityStatus] = useState("Inactive"); 

  const faceLandmarkerRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const requestRef = useRef(null);
  const lastProcessTimeRef = useRef(0);
  const gazeHistoryRef = useRef([]); 
  
  const startTimeRef = useRef(Date.now());
  const statsRef = useRef({
    totalFrames: 0,
    goodEyeContactFrames: 0,
    smilingFrames: 0, 
    centeredFrames: 0,
    handsVisibleFrames: 0,
    handsAwayFromFaceFrames: 0,
    goodVolumeFrames: 0,
    goodPostureFrames: 0,
    goodArticulationFrames: 0,
    standingGoodPostureFrames: 0,
    stageMovementScore: 0
  });

  // --- אפקט לגלילה אוטומטית ---
  useEffect(() => {
    let intervalId;
    if (isScrolling && !isHoveringPrompter && prompterRef.current) {
        const delay = 150 - (scrollSpeed * 1.4); 
        intervalId = setInterval(() => {
            if (prompterRef.current) {
                prompterRef.current.scrollTop += 1; 
            }
        }, Math.max(10, delay));
    }
    return () => clearInterval(intervalId);
  }, [isScrolling, isHoveringPrompter, scrollSpeed]);

  useEffect(() => {
    const createLandmarkers = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
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

  useEffect(() => {
    if (isModelsLoaded && practiceMode) {
        console.log(`🤖 AI Models Loaded - Starting Analysis Loop in ${practiceMode} mode`);
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

  const analyzeLighting = (ctx, width, height) => {
    try {
        const frameData = ctx.getImageData(width / 3, height / 3, width / 3, height / 3).data;
        let totalBrightness = 0;
        for (let i = 0; i < frameData.length; i += 16) { 
            totalBrightness += (frameData[i] + frameData[i + 1] + frameData[i + 2]) / 3;
        }
        if ((totalBrightness / (frameData.length / 16)) < BRIGHTNESS_THRESHOLD) return { status: "Too Dark 🌑", isGood: false };
        return { status: "Lighting Good 💡", isGood: true };
    } catch (e) { return { status: "Checking...", isGood: true }; }
  };

  const analyzeEyeContact = (blendshapes) => {
    if (!blendshapes) return { status: "No Face", isGood: false };
    const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;
    const blink = getScore('eyeBlinkLeft') > 0.5 || getScore('eyeBlinkRight') > 0.5;
    if (blink) return { status: "Blinking 😌", isGood: true };
    const gazeX = getScore('eyeLookInLeft') - getScore('eyeLookOutLeft'); 
    const gazeY = getScore('eyeLookUpLeft') - getScore('eyeLookDownLeft');
    gazeHistoryRef.current.push({ x: gazeX, y: gazeY });
    if (gazeHistoryRef.current.length > 40) gazeHistoryRef.current.shift();
    const xVariance = calculateVariance(gazeHistoryRef.current.map(p => p.x));
    const yVariance = calculateVariance(gazeHistoryRef.current.map(p => p.y));
    if (xVariance > 0.002 && yVariance < 0.001) return { status: "Reading Text 📖", isGood: false };
    if (xVariance < 0.0002 && yVariance < 0.0002 && gazeHistoryRef.current.length >= 40) return { status: "Zoning Out 😶", isGood: false };
    if (Math.abs(gazeX) > 0.4 || Math.abs(gazeY) > 0.4) return { status: "Looking Away 🙄", isGood: false };
    return { status: "Eye Contact 🤩", isGood: true };
  };

  const analyzeHeadTilt = (landmarks) => {
    const angle = Math.atan2(landmarks[263].y - landmarks[33].y, landmarks[263].x - landmarks[33].x) * (180 / Math.PI);
    if (Math.abs(angle) < 8) return "Straight (Authority) 🤴";
    if (Math.abs(angle) < 20) return "Slight Tilt (Empathy) 🙂";
    return "Too Tilted (Unsure) 🫤";
  };

  const analyzeCameraHeight = (faceLandmarks) => {
    const avgEyeY = (faceLandmarks[33].y + faceLandmarks[263].y) / 2;
    if (avgEyeY < 0.25) return "Camera Too Low (Move Up) 🔽";
    if (avgEyeY > 0.55) return "Camera Too High (Move Down) 🔼";
    return "Eye Level Perfect 👌";
  };

  const analyzeChinPitch = (landmarks) => {
      const noseToEyeDist = landmarks[1].y - ((landmarks[33].y + landmarks[263].y) / 2);
      if (noseToEyeDist < 0.055) return "Chin Too High (Arrogant) 🦒";
      if (noseToEyeDist > 0.10) return "Chin Tucked (Insecure) 🙇";
      return "Chin Level (Authority) 👑";
  };

  const analyzeShoulderStability = (poseLandmarks) => {
    if(!poseLandmarks[11] || !poseLandmarks[12]) return { status: "No Shoulders", isLevel: false };
    if (Math.abs(poseLandmarks[11].y - poseLandmarks[12].y) > 0.04) return { status: "Uneven Shoulders ⚖️", isLevel: false };
    return { status: "Posture Great ✅", isLevel: true };
  };

  const analyzeBodyAndHands = (poseLandmarks, faceLandmarks) => {
    if (!poseLandmarks) return { status: "No Body", isGood: false };
    if (!faceLandmarks) return { status: "Hands Open 👐", isGood: true };
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
    if (isTouching) return { status: "Don't touch face! ✋", isGood: false };
    if (!(poseLandmarks[15].visibility > 0.5 || poseLandmarks[16].visibility > 0.5)) return { status: "Hands Hidden 🙈", isGood: false };
    return { status: "Hands Open 👐", isGood: true };
  };

  const analyzeCenteringAndDistance = (faceLandmarks, poseLandmarks) => {
    const nose = faceLandmarks[1];
    let centerStatus = "Centered ✅"; let isCentered = true;
    if (nose.x < 0.4) { centerStatus = "Move Left ⬅️"; isCentered = false; } else if (nose.x > 0.6) { centerStatus = "Move Right ➡️"; isCentered = false; }
    let distStatus = "Perfect Distance ✅";
    if (poseLandmarks) {
        const width = Math.abs(poseLandmarks[11].x - poseLandmarks[12].x);
        if (width < SHOULDER_WIDTH_MIN) distStatus = "Too Far 🔍"; else if (width > SHOULDER_WIDTH_MAX) distStatus = "Too Close 🔙";
    }
    return { centerStatus, isCentered, distStatus };
  };

  const analyzeEngagement = (poseLandmarks) => {
      const width = Math.abs(poseLandmarks[11].x - poseLandmarks[12].x);
      if (width > 0.55) return "Leaning In (Engaged) 🔥";
      if (width < 0.30) return "Leaning Back (Relaxed) 🛋️";
      return "Balanced Posture 🧘";
  };

  const analyzeArticulation = (faceLandmarks, vol) => {
      if (vol < 5) return { status: "Silent 😶", isGood: true }; 
      if (Math.abs(faceLandmarks[13].y - faceLandmarks[14].y) < 0.015) return { status: "Open Mouth More 🗣️", isGood: false };
      return { status: "Clear Speech 📢", isGood: true };
  };

  const analyzeExpression = (blendshapes) => {
    const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;
    const smile = (getScore('mouthSmileLeft') + getScore('mouthSmileRight')) / 2;
    let smileStat = { status: "Neutral 😐", isSmiling: false };
    if (smile > 0.4) smileStat = { status: "Smiling 😊", isSmiling: true };
    const browUp = (getScore('browOuterUpLeft') + getScore('browOuterUpRight') + getScore('browInnerUp')) / 3;
    let browStat = browUp > 0.45 ? "High Energy 😲" : (browUp > 0.2 ? "Expressive 🤨" : "Neutral 😐");
    const squint = (getScore('eyeSquintLeft') + getScore('eyeSquintRight')) / 2;
    let squintStat = squint > 0.6 ? "Squinting (Focus/Doubt) 😑" : "Eyes Open 👀";
    return { smile: smileStat, brow: browStat, squint: squintStat };
  };

  const analyzeAudio = () => {
    if (!analyserRef.current || !dataArrayRef.current) return { status: "Silence", isGood: false, vol: 0 };
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const avg = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length;
    const NOISE_FLOOR = 10;
    let volume = avg > NOISE_FLOOR ? Math.min(100, Math.round((avg - NOISE_FLOOR) * 3)) : 0;
    setVolumeLevel(volume);
    let status = "Silence 🔇"; let isGood = false;
    if (volume > 5) { 
        if (volume > 20 && volume < 85) { status = "Good Volume 🎙️"; isGood = true; }
        else if (volume >= 85) { status = "Too Loud 🔊"; isGood = false; }
        else { status = "Speaking 🔉"; isGood = true; }
    }
    return { status, isGood, vol: volume };
  };

  const drawFaceBox = (ctx, faceLandmarks, isTouching) => {
      if (!faceLandmarks) return;
      const xs = faceLandmarks.map(p => p.x);
      const ys = faceLandmarks.map(p => p.y); 
      
      const pad = 0.05; 
      const minX = Math.min(...xs) - pad;
      const maxX = Math.max(...xs) + pad;
      const minY = Math.min(...ys) - pad;
      const maxY = Math.max(...ys) + pad;
      
      const width = maxX - minX;
      const height = maxY - minY;
      
      ctx.beginPath();
      ctx.lineWidth = 3;
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
  };

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
        let isTouchingFace = false;
        const faceLms = faceResult.faceLandmarks?.[0];
        const poseLms = poseResult.landmarks?.[0];

        if (practiceMode === 'sitting') {
            if (Date.now() - lastProcessTimeRef.current > 100) {
                const lightRes = analyzeLighting(ctx, canvas.width, canvas.height);
                setLightingStatus(lightRes.status);
                const audioRes = analyzeAudio(); setAudioStatus(audioRes.status);
                let eyeRes = { status: "No Face", isGood: false };
                let posRes = { centerStatus: "No Face", isCentered: false, distStatus: "Waiting..." };
                let exprRes = { smile: { status: "Neutral 😐", isSmiling: false }, brow: "Neutral 😐", squint: "..." };
                let bodyRes = { status: "No Body", isGood: false };
                let articRes = { status: "Silent", isGood: true }; 
                let shoulderRes = { status: "Checking...", isLevel: false };

                if (faceLms) {
                    posRes = analyzeCenteringAndDistance(faceLms, poseLms);
                    setCenteringStatus(posRes.centerStatus); setDistanceStatus(posRes.distStatus);
                    setHeadTiltStatus(analyzeHeadTilt(faceLms));
                    articRes = analyzeArticulation(faceLms, audioRes.vol); setArticulationStatus(articRes.status);
                    setCameraHeightStatus(analyzeCameraHeight(faceLms));
                    setChinStatus(analyzeChinPitch(faceLms));
                }
                if (faceResult.faceBlendshapes?.[0]) {
                    eyeRes = analyzeEyeContact(faceResult.faceBlendshapes[0].categories); setEyeContactStatus(eyeRes.status);
                    exprRes = analyzeExpression(faceResult.faceBlendshapes[0].categories);
                    setExpressionStatus(exprRes.smile.status); setBrowStatus(exprRes.brow); setSquintStatus(exprRes.squint);
                }
                if (poseLms) {
                    bodyRes = faceLms ? analyzeBodyAndHands(poseLms, faceLms) : { status: (poseLms[15].visibility > 0.5 || poseLms[16].visibility > 0.5) ? "Hands Open 👐" : "Hands Hidden 🙈", isGood: false };
                    setBodyStatus(bodyRes.status); if (!bodyRes.isGood) isTouchingFace = true;
                    setEngagementStatus(analyzeEngagement(poseLms));
                    shoulderRes = analyzeShoulderStability(poseLms); setShoulderStatus(shoulderRes.status);
                }
                if (eyeRes.status !== "No Face") {
                    statsRef.current.totalFrames += 1;
                    if (eyeRes.isGood) statsRef.current.goodEyeContactFrames += 1;
                    if (posRes.isCentered) statsRef.current.centeredFrames += 1;
                    if (exprRes.smile.isSmiling) statsRef.current.smilingFrames += 1;
                    if (bodyRes.isGood) statsRef.current.handsAwayFromFaceFrames += 1;
                    if (audioRes.isGood) statsRef.current.goodVolumeFrames += 1;
                    if (articRes.isGood) statsRef.current.goodArticulationFrames += 1;
                    if (shoulderRes.isLevel) statsRef.current.goodPostureFrames += 1;
                }
                lastProcessTimeRef.current = Date.now();
            } else { if (bodyStatus.includes("Don't touch")) isTouchingFace = true; }
            if (faceLms) drawFaceBox(ctx, faceLms, isTouchingFace);
            if (poseLms) drawHands(ctx, poseLms, isTouchingFace);
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

                    if (distRes.isGood && headRes.isGood && postureRes.isGood && moveRes.isGood && handsRes.isGood) {
                         statsRef.current.standingGoodPostureFrames += 1;
                         statsRef.current.stageMovementScore += 1;
                         statsRef.current.handsVisibleFrames += 1; 
                    }
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
    
    // סגירת ההקלטה בצורה מסודרת
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
    const total = statsRef.current.totalFrames || 1;
    
    const scores = {
        eyeContact: Math.round((statsRef.current.goodEyeContactFrames / total) * 100),
        expression: Math.round((statsRef.current.smilingFrames / total) * 100),
        centering: Math.round((statsRef.current.centeredFrames / total) * 100),
        hands: Math.round((statsRef.current.handsAwayFromFaceFrames / total) * 100),
        volume: Math.round((statsRef.current.goodVolumeFrames / total) * 100),
        articulation: Math.round((statsRef.current.goodArticulationFrames / total) * 100),
        posture: Math.round((statsRef.current.goodPostureFrames / total) * 100)
    };
    
    const finalScore = ((scores.eyeContact * 0.25) + (scores.centering * 0.15) + (scores.expression * 0.1) + (scores.hands * 0.15) + (scores.volume * 0.15) + (scores.posture * 0.1) + (scores.articulation * 0.1)).toFixed(1);
    
    // === הכנת המידע המעודכן לשליחה ===
    const sessionData = {
        userId: user ? user.id : "Guest", 
        
        // שדות חדשים לסינון והשוואה
        speechTitle: speechTitle || "Free Practice", // שם הנאום
        practiceMode: practiceMode || 'sitting',     // ישיבה או עמידה
        
        date: new Date(),
        duration: formattedDuration,
        overallScore: finalScore,
        metrics: scores,
    };
    
    navigate('/summary', { 
        state: { 
            realData: sessionData, 
            videoBlob: videoBlob
        } 
    });
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
                
                {practiceMode === 'sitting' && (
                    <>
                        {lightingStatus.includes("Dark") && <Badge bg="warning" className="position-absolute top-0 start-50 translate-middle-x m-3 text-dark">⚠️ תאורה חלשה</Badge>}
                        {distanceStatus.includes("Too") && <Badge bg="info" className="position-absolute bottom-0 start-50 translate-middle-x m-5">{distanceStatus}</Badge>}
                        {bodyStatus.includes("Don't touch") && <Badge bg="danger" className="position-absolute top-50 start-50 translate-middle p-3 fs-5 opacity-75">❌ הרחק ידיים מהפנים</Badge>}
                        {articulationStatus.includes("Open") && <Badge bg="warning" className="position-absolute bottom-50 start-50 translate-middle p-2 text-dark">🗣️ דבר ברור יותר (פתח פה)</Badge>}
                        {cameraHeightStatus.includes("Move") && <Badge bg="info" className="position-absolute bottom-0 start-50 translate-middle-x mb-2 fs-6 opacity-90">{cameraHeightStatus}</Badge>}
                    </>
                )}
                
                {practiceMode === 'standing' && ( <StageOverlay posture={postureStatus} movement={stageMovementStatus} hands={handsActivityStatus} /> )}

                {error && <div className="text-white p-3">{error}</div>}
                
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }} />
                  <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)', pointerEvents: 'none' }} />
                  
                  {/* === הטלפרומפטר החדש (פלקסבוקס עם צדדים) === */}
                  {speechText && showTeleprompter && (
                    <div className="position-absolute top-0 start-50 translate-middle-x mt-3 d-flex align-items-start gap-3" style={{ width: '80%', zIndex: 100 }}>
                        
                        {/* Text Area - לוקח את רוב המקום */}
                        <div 
                            ref={prompterRef}
                            onMouseEnter={() => setIsHoveringPrompter(true)}
                            onMouseLeave={() => setIsHoveringPrompter(false)}
                            className="bg-dark text-white p-3 text-center shadow-lg"
                            style={{
                                flex: 1,
                                maxHeight: '20vh',
                                overflowY: 'auto',
                                borderRadius: '15px',
                                fontSize: '1.2rem',
                                lineHeight: '1.6',
                                opacity: 0.7, // שקוף יותר
                                backdropFilter: 'blur(5px)',
                                scrollBehavior: 'smooth'
                            }}
                        >
                            <h5 className="text-muted mb-2 fs-6">{speechTitle}</h5>
                            {speechText}
                            <div style={{ height: '100px' }}></div> 
                        </div>

                        {/* Controls - בצד ימין למעלה */}
                        <div className="d-flex flex-column gap-2 bg-white p-2 rounded shadow-sm opacity-75 align-items-center">
                            <Button 
                                variant={isScrolling ? "warning" : "success"} 
                                size="sm" 
                                className="rounded-circle d-flex align-items-center justify-content-center p-0"
                                style={{ width: '35px', height: '35px' }}
                                onClick={() => setIsScrolling(!isScrolling)}
                            >
                                {isScrolling ? "⏸" : "▶"}
                            </Button>
                            
                            <div className="d-flex flex-column align-items-center">
                                <small className="text-muted fw-bold" style={{fontSize: '0.6rem'}}>SPD</small>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="100" 
                                    value={scrollSpeed} 
                                    onChange={(e) => setScrollSpeed(Number(e.target.value))}
                                    style={{ width: '60px', cursor: 'pointer' }}
                                />
                            </div>
                        </div>
                    </div>
                  )}
                  {/* ============================================== */}

                </div>
              </Card>
            </Col>

            <Col lg={3} className="h-100 pb-2">
              <Card className="h-100 border-0 shadow-sm bg-white" style={{ borderRadius: '20px', overflowY: 'auto' }}>
                <Card.Header className="bg-transparent border-0 pt-4 px-4"><h6 className="font-weight-bold m-0" style={{ color: '#333' }}>Analysis Metrics</h6></Card.Header>
                {practiceMode === 'sitting' && (
                <Card.Body className="d-flex flex-column px-4 gap-2">
                  <div className="p-2 mb-2" style={{ borderLeft: '3px solid #6c757d', backgroundColor: '#f8f9fa' }}>
                      <small className="text-muted d-block">ENVIRONMENT</small>
                      <div style={{ fontSize: '0.85rem' }}>{lightingStatus}</div>
                      <div style={{ fontSize: '0.85rem' }}>{distanceStatus}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: cameraHeightStatus.includes("Perfect") ? 'bold' : 'normal', color: cameraHeightStatus.includes("Perfect") ? 'green' : 'orange' }}>{cameraHeightStatus}</div>
                  </div>
                  <div className="text-center p-2" style={{ backgroundColor: '#fff3cd', borderRadius: '12px' }}>
                    <small className="text-muted d-block mb-1">EXPRESSION & HEAD</small>
                    <div style={{ fontWeight: '700', color: expressionStatus.includes("Smiling") ? '#28a745' : '#555' }}>{expressionStatus}</div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', marginTop: '5px', color: '#007bff' }}>Brows: {browStatus}</div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', marginTop: '5px', color: '#555' }}>{headTiltStatus}</div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', marginTop: '5px', color: chinStatus.includes("Level") ? 'green' : '#dc3545' }}>{chinStatus}</div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', marginTop: '5px', color: squintStatus.includes("Squinting") ? '#dc3545' : 'green' }}>{squintStatus}</div>
                  </div>
                  <div className="text-center p-2" style={{ backgroundColor: '#e2e6ea', borderRadius: '12px', border: eyeContactStatus.includes("Reading") ? '2px solid #17a2b8' : 'none' }}>
                    <small className="text-muted d-block mb-1">EYE CONTACT</small>
                    <div style={{ fontWeight: '700', color: eyeContactStatus.includes("Good") ? '#28a745' : (eyeContactStatus.includes("Reading") ? '#17a2b8' : '#dc3545') }}>{eyeContactStatus}</div>
                  </div>
                  <div className="d-flex justify-content-between gap-2">
                      <div className="text-center p-2 w-50" style={{ backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
                          <small className="text-muted d-block">POSTURE</small>
                          <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{centeringStatus}</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginTop: '5px', color: '#666' }}>{engagementStatus}</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginTop: '5px', color: shoulderStatus.includes("Uneven") ? 'orange' : 'green' }}>{shoulderStatus}</div>
                      </div>
                      <div className="text-center p-2 w-50" style={{ backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
                          <small className="text-muted d-block">HANDS</small>
                          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: bodyStatus.includes("touch") ? 'red' : 'green' }}>{bodyStatus}</div>
                      </div>
                  </div>
                  <div className="text-center p-3 mt-auto" style={{ backgroundColor: '#f8f9fa', borderRadius: '15px' }}>
                    <div className="d-flex justify-content-between mb-1"><small className="text-muted">VOLUME & CLARITY</small><small style={{fontSize: '0.7rem'}}>{volumeLevel}%</small></div>
                    <ProgressBar now={volumeLevel} variant={volumeLevel > 75 ? "danger" : "primary"} style={{ height: '6px', borderRadius: '5px', marginBottom: '8px' }} />
                    <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#555' }}>{audioStatus}</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '5px', color: articulationStatus.includes("Open") ? 'red' : 'green' }}>{articulationStatus}</div>
                  </div>
                </Card.Body>
                )}
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