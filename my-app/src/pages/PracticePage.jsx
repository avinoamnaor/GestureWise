import React, { useEffect, useRef, useState } from 'react';

// --- Libraries ---
import { Container, Row, Col, Card, Button, Badge, Modal } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';

// --- Contexts & Core Hooks ---
import { useAuth } from '../context/AuthContext';
import { usePracticeAI } from '../hooks/usePracticeAI';     // Infrastructure (Models)
import { useSessionRecorder } from '../hooks/useSessionRecorder'; 
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';     

// --- Logic Hooks ---
import { useSittingLogic } from '../hooks/useSittingLogic';  
import { useStandingLogic } from '../hooks/useStandingLogic'; 

// --- UI Components ---
import SmartToast from '../components/practice/SmartToast';
import StageOverlay from '../components/practice/StageOverlay';
import DashboardMetric from '../components/practice/DashboardMetric';
import FloatingVolume from '../components/practice/FloatingVolume';
// import { drawFaceBox, drawHands } from '../utils/canvasUtils.js'; 

function PracticePage() {
  // --- Router & Auth (Setup) ---
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { speechText, speechTitle } = location.state || {};

  // --- Session Flow State ---
  const [practiceMode, setPracticeMode] = useState(null); 
  const [showModeSelector, setShowModeSelector] = useState(true); 
  const [isSetupPhase, setIsSetupPhase] = useState(true);

  // --- Core Infrastructure Hooks ---
  const { faceLandmarkerRef, poseLandmarkerRef, isModelsLoaded, aiError } = usePracticeAI();
  const { startRecording, stopSession, isSaving } = useSessionRecorder();
  const { volumeLevel, setupAudio, analyzeVolume } = useAudioAnalysis();

  // Sitting Logic
  const { 
    sittingFeedback, liveScore, processSittingFrame, sessionStatsRef 
  } = useSittingLogic();

  // Standing Logic
  const { 
      postureStatus, stageMovementStatus, handsActivityStatus, processStandingFrame 
  } = useStandingLogic();

  // --- Teleprompter State ---
  const [showTeleprompter, setShowTeleprompter] = useState(!!speechText);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30); 
  const [isHoveringPrompter, setIsHoveringPrompter] = useState(false);
  const prompterRef = useRef(null);

  // --- Technical Refs ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);      // Holds the animation frame ID
  const lastProcessTimeRef = useRef(0); // Controls the throttling (50ms/100ms)
  const isLoopRunning = useRef(false);  // <--- NEW: The Kill Switch Ref

  
  // --- Effects ---

  // Catch and log errors originating from usePracticeAI
  useEffect(() => { if (aiError) console.error(aiError); }, [aiError]);

  // Teleprompter Scrolling
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

  // Initialize camera stream, setup audio analysis, and handle cleanup on unmount
  useEffect(() => {
    const startMedia = async () => {
      try {
        const constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) videoRef.current.srcObject = stream;
        
        startRecording(stream);
        setupAudio(stream);

      } catch (err) { console.error("Could not access camera/microphone."); }
    };
    startMedia();

    return () => {
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

// Manage the 10-second calibration phase for sitting mode (skipped for standing)
  useEffect(() => {
    if (isModelsLoaded) {
        if (practiceMode === 'sitting') {
            setIsSetupPhase(true); 
            const timer = setTimeout(() => {
                setIsSetupPhase(false);
            }, 10000); 
            return () => clearTimeout(timer);
        } 
        else if (practiceMode === 'standing') {
            setIsSetupPhase(false);
        }
    }
  }, [isModelsLoaded, practiceMode]);

  // Main Loop Trigger
  useEffect(() => {
    if (isModelsLoaded && practiceMode) {
        isLoopRunning.current = true; 
        predictWebcam();
    }
    return () => { isLoopRunning.current = false; }; 
  }, [isModelsLoaded, practiceMode]);


  // Main Loop
  const predictWebcam = () => {
    if (!isLoopRunning.current) return; 

    const video = videoRef.current;
    const canvas = canvasRef.current;
    // ensure all elements and ai models are ready before processing
    if (video && canvas && faceLandmarkerRef.current && poseLandmarkerRef.current && video.readyState >= 2) {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d"); 
        let startTimeMs = performance.now();
        // detect landmarks for every frame
        const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
        const poseResult = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);
        // clear previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const faceLms = faceResult.faceLandmarks?.[0];
        const poseLms = poseResult.landmarks?.[0];

        // SITTING MODE
        if (practiceMode === 'sitting') {
          // higher frequency (50ms)
            if (Date.now() - lastProcessTimeRef.current > 50) { 
                const audioRes = analyzeVolume();
                processSittingFrame(faceResult, poseResult, video, audioRes.vol);
                lastProcessTimeRef.current = Date.now();
            }
        } 
        
        // STANDING MODE 
        else if (practiceMode === 'standing') {
            // (100ms) since body movements are slower and require less cpu
            if (Date.now() - lastProcessTimeRef.current > 100) {
                processStandingFrame(poseLms, faceLms);
                lastProcessTimeRef.current = Date.now();
            }
        }
      }
    }
    // recursive call synced with the browser refresh rate for smooth animation
    if (isLoopRunning.current) { 
        requestRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  // Aggregate real-time metrics from Refs, await storage completion, and transition to Summary with pre-loaded data
  const handleStopSession = async () => {
    isLoopRunning.current = false; 
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    const { sessionData, videoBlob } = await stopSession(sessionStatsRef.current, liveScore, user, speechTitle, practiceMode
    );
    // Pass data via router state to avoid redundant server fetching on the next page
    navigate('/summary', { state: { realData: sessionData, videoBlob } });
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

                {/* --- SMART TOAST (From Hook) --- */}
                {practiceMode === 'sitting' && (
                    <SmartToast 
                        message={sittingFeedback.smartToast?.text} 
                        type={sittingFeedback.smartToast?.type}
                        position={(speechText && showTeleprompter) ? 'bottom' : 'top'}
                    />
                )}
                
                {/* כאן השימוש במשתנים החדשים שהגיעו מה-Hook */}
                {practiceMode === 'standing' && ( <StageOverlay posture={postureStatus} movement={stageMovementStatus} hands={handsActivityStatus} /> )}

                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }} />
                  <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)', pointerEvents: 'none' }} />
                  
                  {practiceMode === 'sitting' && <FloatingVolume volumeLevel={volumeLevel} />}

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
                  <div className="text-center p-1 bg-light border rounded flex-shrink-0">
                      <small className="text-muted fw-bold" style={{ fontSize: '0.65rem' }}>LIVE SCORE</small>
                      <div style={{ fontSize: '2.2rem', fontWeight: '800', lineHeight: 1, color: liveScore > 80 ? '#28a745' : (liveScore > 60 ? '#ffc107' : '#dc3545') }}>
                          {liveScore}
                      </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden', justifyContent: 'space-evenly' }}>
                      {isSetupPhase && (
                        <>
                            <DashboardMetric label="Lighting" value={sittingFeedback.lighting} />
                            <DashboardMetric label="Distance" value={sittingFeedback.distance} />
                            <DashboardMetric label="Camera Height" value={sittingFeedback.cameraHeight} />
                        </>
                      )}
                      {!isSetupPhase && (
                        <>
                            <DashboardMetric label="EYES" value={sittingFeedback.eyeContact} />
                            <DashboardMetric label="HEAD & FACE" value={sittingFeedback.headTilt} subValue={sittingFeedback.chin} />
                            <DashboardMetric label="SHOULDERS" value={sittingFeedback.shoulders} />
                            <DashboardMetric label="POSTURE" value={sittingFeedback.centering} subValue={sittingFeedback.engagement} />
                            <DashboardMetric label="HANDS" value={sittingFeedback.body} />
                        </>
                      )}
                  </div>
                </Card.Body>
                )}

                {/* --- Standing Mode Display (Fixed Layout) --- */}
                {practiceMode === 'standing' && (
                    <Card.Body className="d-flex flex-column p-3 h-100">
                         {/* הכותרת לא מתכווצת */}
                         <h6 className="text-muted mb-2 flex-shrink-0">STAGE ANALYSIS</h6>
                         
                         {/* הקונטיינר של הכרטיסים תופס את כל הגובה שנשאר */}
                         <div className="d-flex flex-column gap-2 h-100" style={{ minHeight: 0 }}>
                             
                             {/* 1. Posture Card - מתרחב (flex: 1) וממרכז את התוכן */}
                             <div 
                                className={`rounded text-center border d-flex flex-column justify-content-center align-items-center ${postureStatus.includes("Step") ? 'bg-danger text-white' : 'bg-light'}`}
                                style={{ flex: 1, minHeight: 0 }}
                             >
                                 <strong className="d-block mb-1">Posture & Position</strong>
                                 <div className="fs-5 fw-bold" style={{ lineHeight: 1.2 }}>{postureStatus}</div>
                             </div>
                             
                             {/* 2. Movement Card - מתרחב (flex: 1) */}
                             <div 
                                className="bg-light rounded text-center border d-flex flex-column justify-content-center align-items-center"
                                style={{ flex: 1, minHeight: 0 }}
                             >
                                 <strong className="d-block mb-1">Movement</strong>
                                 <div className="text-primary fw-bold fs-5" style={{ lineHeight: 1.2 }}>{stageMovementStatus}</div>
                             </div>
                             
                             {/* 3. Hands Card - מתרחב (flex: 1) */}
                             <div 
                                className="bg-light rounded text-center border d-flex flex-column justify-content-center align-items-center"
                                style={{ flex: 1, minHeight: 0 }}
                             >
                                 <strong className="d-block mb-1">Hands</strong>
                                 <div className="text-info fw-bold fs-5" style={{ lineHeight: 1.2 }}>{handsActivityStatus}</div>
                             </div>

                         </div>
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