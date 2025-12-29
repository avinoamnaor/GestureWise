import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card, Button, Badge, ProgressBar } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// פונקציית עזר לחישוב פיזור/שונות (כדי לזהות קריאה או בהייה)
const calculateVariance = (arr) => {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return variance; 
};

function PracticePage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Audio Refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  
  // States
  const [error, setError] = useState(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  
  // Analysis States
  const [centeringStatus, setCenteringStatus] = useState("Checking..."); 
  const [expressionStatus, setExpressionStatus] = useState("Neutral 😐"); 
  const [eyeContactStatus, setEyeContactStatus] = useState("Waiting..."); // החכם חוזר!
  const [bodyStatus, setBodyStatus] = useState("Waiting...");
  const [volumeLevel, setVolumeLevel] = useState(0); 
  const [audioStatus, setAudioStatus] = useState("Listening...");

  // AI Refs
  const faceLandmarkerRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const requestRef = useRef(null);
  const lastProcessTimeRef = useRef(0);
  
  // Refs ללוגיקה החכמה של העיניים
  const gazeHistoryRef = useRef([]); // כאן נשמור את היסטוריית המבט

  // Stats
  const startTimeRef = useRef(Date.now());
  const statsRef = useRef({
    totalFrames: 0,
    goodEyeContactFrames: 0,
    smilingFrames: 0, 
    centeredFrames: 0,
    handsVisibleFrames: 0,
    goodVolumeFrames: 0
  });

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
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", predictWebcam);
        }
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;
      } catch (err) { setError("Could not access camera/microphone."); }
    };
    startMedia();

    return () => {
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // --- לוגיקה חכמה לעיניים (Reading / Zoning Out) ---
  const analyzeEyeContact = (blendshapes) => {
    if (!blendshapes) return { status: "No Face", isGood: false };
    const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;

    // 1. מצמוץ (עדיפות עליונה)
    const blink = getScore('eyeBlinkLeft') > 0.5 || getScore('eyeBlinkRight') > 0.5;
    if (blink) return { status: "Blinking 😌", isGood: true };

    // 2. חישוב וקטור מבט
    const gazeX = getScore('eyeLookInLeft') - getScore('eyeLookOutLeft'); 
    const gazeY = getScore('eyeLookUpLeft') - getScore('eyeLookDownLeft');
    
    // הוספה להיסטוריה (עד 40 פריימים אחרונים)
    gazeHistoryRef.current.push({ x: gazeX, y: gazeY });
    if (gazeHistoryRef.current.length > 40) gazeHistoryRef.current.shift();

    // חישוב שונות (כמה העין זזה?)
    const xValues = gazeHistoryRef.current.map(p => p.x);
    const yValues = gazeHistoryRef.current.map(p => p.y);
    const xVariance = calculateVariance(xValues);
    const yVariance = calculateVariance(yValues);

    // --- זיהוי קריאה (Reading) ---
    // תנאי: תזוזה רבה ב-X (סריקת שורות) + תזוזה מועטה ב-Y (נשארים על השורה)
    // הערך 0.002 הוא הרף שמצאנו שעובד טוב
    if (xVariance > 0.002 && yVariance < 0.001) {
       return { status: "Reading Text 📖", isGood: false };
    }

    // --- זיהוי בהייה (Zoning Out) ---
    // תנאי: כמעט אפס תזוזה ב-X וב-Y למשך כל ההיסטוריה
    if (xVariance < 0.0002 && yVariance < 0.0002 && gazeHistoryRef.current.length >= 40) {
       return { status: "Zoning Out 😶", isGood: false };
    }

    // --- זיהוי הסטת מבט רגילה ---
    const gazeThreshold = 0.4;
    const lookingAway = 
      getScore('eyeLookInLeft') > gazeThreshold || getScore('eyeLookOutLeft') > gazeThreshold ||
      getScore('eyeLookUpLeft') > gazeThreshold || getScore('eyeLookDownLeft') > gazeThreshold;

    if (lookingAway) return { status: "Looking Away 🙄", isGood: false };

    // ברירת מחדל
    return { status: "Good Eye Contact 🤩", isGood: true };
  };

  // --- שאר הלוגיקות (מירכוז, חיוך, גוף) ---
  const analyzeCentering = (landmarks) => {
    const nose = landmarks[1];
    if (!nose) return { status: "No Face", isGood: false };
    const x = nose.x;
    if (x < 0.4) return { status: "Move Left ⬅️", isGood: false };
    if (x > 0.6) return { status: "Move Right ➡️", isGood: false };
    return { status: "Centered ✅", isGood: true };
  };

  const analyzeExpression = (blendshapes) => {
    const getScore = (name) => blendshapes.find(b => b.categoryName === name)?.score || 0;
    const smileIntensity = (getScore('mouthSmileLeft') + getScore('mouthSmileRight')) / 2;
    if (smileIntensity > 0.5) return { status: "Smiling 😊", isSmiling: true };
    return { status: "Neutral 😐", isSmiling: false };
  };

  const analyzeAudio = () => {
    if (!analyserRef.current || !dataArrayRef.current) return { status: "Silence", isGood: false, vol: 0 };
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0; for (let i = 0; i < dataArrayRef.current.length; i++) sum += dataArrayRef.current[i];
    const avg = sum / dataArrayRef.current.length;
    const volume = Math.min(100, Math.round(avg * 2));
    setVolumeLevel(volume);
    let status = "Silence 🔇"; let isGood = false;
    if (volume > 10) { status = volume > 30 ? "Great Projection 🎙️" : "Speaking 🔉"; isGood = true; }
    return { status, isGood, vol: volume };
  };

  const analyzeBodyLanguage = (landmarks) => {
    if (!landmarks) return { status: "No Body", isVisible: false };
    const leftWrist = landmarks[15]; const rightWrist = landmarks[16];
    const isVisible = (point) => point.y < 1.0 && point.visibility > 0.5;
    if (isVisible(leftWrist) || isVisible(rightWrist)) return { status: "Hands Visible 👐", isVisible: true };
    return { status: "Hands Hidden 🙈", isVisible: false };
  };

  const handleStopSession = () => {
    const durationSeconds = (Date.now() - startTimeRef.current) / 1000;
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = Math.floor(durationSeconds % 60);
    const formattedDuration = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    const total = statsRef.current.totalFrames || 1;
    const eyeScore = Math.round((statsRef.current.goodEyeContactFrames / total) * 100);
    const smileScore = Math.round((statsRef.current.smilingFrames / total) * 100);
    const handsScore = Math.round((statsRef.current.handsVisibleFrames / total) * 100);
    const volumeScore = Math.round((statsRef.current.goodVolumeFrames / total) * 100);
    const centerScore = Math.round((statsRef.current.centeredFrames / total) * 100);

    const finalScore = ((eyeScore * 0.3) + (centerScore * 0.15) + (smileScore * 0.15) + (handsScore * 0.2) + (volumeScore * 0.2)) / 10;

    const sessionData = {
      speechTitle: "Live Practice Session",
      date: new Date().toLocaleDateString(),
      duration: formattedDuration,
      overallScore: finalScore.toFixed(1),
      metrics: {
        eyeContact: eyeScore,
        expression: smileScore,
        centering: centerScore,
        handGestures: handsScore,
        pacing: volumeScore,
      },
      feedback: { good: [], improvements: [] }
    };

    // דוגמה לפידבק
    if (eyeScore < 60) sessionData.feedback.improvements.push("Avoid reading off the screen too much.");

    navigate('/summary', { state: sessionData });
  };

  const predictWebcam = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && faceLandmarkerRef.current && poseLandmarkerRef.current) {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
        let startTimeMs = performance.now();
        const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
        const poseResult = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);

        if (poseResult.landmarks) for (const lm of poseResult.landmarks) drawPose(ctx, lm);
        if (faceResult.faceLandmarks) for (const lm of faceResult.faceLandmarks) drawFace(ctx, lm);

        if (Date.now() - lastProcessTimeRef.current > 100) {
          const audioRes = analyzeAudio(); setAudioStatus(audioRes.status);
          
          let eyeRes = { status: "No Face", isGood: false };
          let centerRes = { status: "Checking...", isGood: false };
          let smileRes = { status: "Neutral 😐", isSmiling: false };

          if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
             centerRes = analyzeCentering(faceResult.faceLandmarks[0]);
             setCenteringStatus(centerRes.status);
          }

          if (faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0) {
            const blends = faceResult.faceBlendshapes[0].categories;
            // הפעלת הלוגיקה החכמה של העיניים!
            eyeRes = analyzeEyeContact(blends);
            setEyeContactStatus(eyeRes.status);

            smileRes = analyzeExpression(blends);
            setExpressionStatus(smileRes.status);
          }

          let bodyRes = { status: "No Body", isVisible: false };
          if (poseResult.landmarks && poseResult.landmarks.length > 0) {
            bodyRes = analyzeBodyLanguage(poseResult.landmarks[0]);
            setBodyStatus(bodyRes.status);
          }

          if (eyeRes.status !== "No Face") {
            statsRef.current.totalFrames += 1;
            if (eyeRes.isGood) statsRef.current.goodEyeContactFrames += 1;
            if (centerRes.isGood) statsRef.current.centeredFrames += 1;
            if (smileRes.isSmiling) statsRef.current.smilingFrames += 1;
            if (bodyRes.isVisible) statsRef.current.handsVisibleFrames += 1;
            if (audioRes.isGood) statsRef.current.goodVolumeFrames += 1;
          }
          lastProcessTimeRef.current = Date.now();
        }
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const drawFace = (ctx, landmarks) => { ctx.fillStyle = "rgba(0, 255, 0, 0.4)"; for (const point of landmarks) { ctx.beginPath(); ctx.arc(point.x * ctx.canvas.width, point.y * ctx.canvas.height, 1, 0, 2 * Math.PI); ctx.fill(); }};
  const drawPose = (ctx, landmarks) => { ctx.strokeStyle = "cyan"; ctx.lineWidth = 3; const connections = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24]]; connections.forEach(([start, end]) => { const p1 = landmarks[start]; const p2 = landmarks[end]; if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) { ctx.beginPath(); ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height); ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height); ctx.stroke(); }});};

  return (
    <div style={{ height: 'calc(100vh - 80px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="bg-white border-bottom px-4 py-2 d-flex justify-content-between align-items-center" style={{ flexShrink: 0 }}>
        <div><h5 className="m-0 font-weight-bold">Live Practice</h5><small className={isModelsLoaded ? "text-success" : "text-warning"}>{isModelsLoaded ? "AI Active: Reading & Zoning Out Restored" : "Loading Models..."}</small></div>
        <Button variant="outline-danger" size="sm" onClick={handleStopSession} style={{ borderRadius: '20px', padding: '5px 20px' }}>Stop</Button>
      </div>

      <div className="flex-grow-1 p-3" style={{ overflow: 'hidden', backgroundColor: '#f4f4f4' }}>
        <Container fluid style={{ height: '100%' }}>
          <Row style={{ height: '100%' }}>
            <Col lg={9} className="h-100 pb-2">
              <Card className="h-100 shadow-sm border-0 position-relative" style={{ borderRadius: '20px', overflow: 'hidden', backgroundColor: '#2c3e50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="position-absolute top-0 start-0 m-3 z-index-10"><Badge bg="danger">LIVE</Badge></div>
                {error && <div className="text-white p-3">{error}</div>}
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }} />
                  <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)', pointerEvents: 'none' }} />
                </div>
              </Card>
            </Col>

            <Col lg={3} className="h-100 pb-2">
              <Card className="h-100 border-0 shadow-sm bg-white" style={{ borderRadius: '20px', overflowY: 'auto' }}>
                <Card.Header className="bg-transparent border-0 pt-4 px-4"><h6 className="font-weight-bold m-0" style={{ color: '#333' }}>Real-time Analysis</h6></Card.Header>
                <Card.Body className="d-flex flex-column px-4 gap-3">
                  
                  {/* חיוך ומירכוז - שומרים כי זה עבד טוב */}
                  <div className="text-center p-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '15px' }}>
                    <small className="text-muted d-block mb-1">EXPRESSION</small>
                    <div style={{ fontWeight: '700', color: expressionStatus.includes("Smiling") ? '#28a745' : '#555' }}>{expressionStatus}</div>
                  </div>
                  <div className="text-center p-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '15px' }}>
                    <small className="text-muted d-block mb-1">FRAMING</small>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: centeringStatus.includes("Centered") ? '#28a745' : '#dc3545' }}>{centeringStatus}</div>
                  </div>

                  {/* הכרטיס של העיניים - עכשיו חכם יותר */}
                  <div className="text-center p-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '15px' }}>
                    <small className="text-muted d-block mb-1">EYES</small>
                    <div style={{ 
                        fontWeight: '700', 
                        color: eyeContactStatus.includes("Good") ? '#28a745' : 
                               (eyeContactStatus.includes("Reading") ? '#17a2b8' : '#dc3545') 
                    }}>
                      {eyeContactStatus}
                    </div>
                  </div>

                  <div className="text-center p-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '15px' }}>
                    <small className="text-muted d-block mb-1">HANDS</small>
                    <div style={{ fontWeight: '700', color: bodyStatus.includes("Visible") ? '#28a745' : '#ffc107' }}>{bodyStatus}</div>
                  </div>
                  <div className="text-center p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '15px' }}>
                    <small className="text-muted d-block mb-1">VOLUME</small>
                    <ProgressBar now={volumeLevel} variant="primary" style={{ height: '8px', borderRadius: '5px', marginBottom: '8px' }} />
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#555' }}>{audioStatus}</div>
                  </div>
                  <Button variant="danger" className="w-100 py-2 mt-auto shadow-sm" style={{ borderRadius: '50px' }} onClick={handleStopSession}>Stop Session</Button>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
}

export default PracticePage;