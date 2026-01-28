import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, ProgressBar, Badge, Spinner, Form, Modal } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Data passed from the practice session
  const { realData, videoBlob } = location.state || {};
  
  const [localVideoUrl, setLocalVideoUrl] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle"); 
  const hasStartedProcessing = useRef(false);

  // Session State
  const [sessionId, setSessionId] = useState(null); 
  const [isPublic, setIsPublic] = useState(false);  
  const [topSessions, setTopSessions] = useState([]); // Hall of Fame list
  const [viewingVideo, setViewingVideo] = useState(null); // Currently watching other user's video

  const [transcriptionData, setTranscriptionData] = useState(null);

  // Helper: Determine pace feedback based on WPM
  const getWpmFeedback = (wpm) => {
      if (!wpm) return { text: "Analyzing...", color: "secondary" };
      const speed = parseFloat(wpm);
      if (speed < 100) return { text: "Too Slow 🐢", color: "warning" };
      if (speed > 160) return { text: "Too Fast 🐇", color: "danger" };
      return { text: "Perfect Pace 🎯", color: "success" };
  };

  // Auth Guard
  if (!user) {
      return (
        <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: '100vh', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
            <div className="bg-white p-5 shadow-sm" style={{ borderRadius: '20px', maxWidth: '500px' }}>
                <h2 style={{ fontWeight: '800', color: '#2c3e50' }}>Login Required</h2>
                <Button variant="primary" className="mt-3" onClick={() => navigate('/login')}>Log In</Button>
            </div>
        </div>
      );
  }

  // Default data fallback
  const sessionData = realData || {
    date: new Date(),
    speechType: "Demo Practice",
    speechTitle: "Free Practice",
    practiceMode: "sitting",
    duration: "0:00",
    overallScore: 0,
    metrics: { eyeContact: 0, expression: 0, centering: 0, hands: 0, volume: 0, articulation: 0, posture: 0 }
  };

  // Simple feedback logic (Rule-based)
  const generateAIFeedback = (metrics) => {
    let feedback = [];
    if (metrics.eyeContact < 60) feedback.push("Try to look at the camera more often.");
    if (metrics.volume < 40) feedback.push("Speak louder!");
    if (metrics.hands < 50) feedback.push("Use more hand gestures.");
    if (feedback.length === 0) return "Outstanding performance! Keep it up!";
    return `Tips: ${feedback.slice(0, 2).join(" ")}`;
  };

  const feedbackText = generateAIFeedback(sessionData.metrics);

  // 1. Video Setup & Historical Data
  useEffect(() => {
      if (videoBlob) {
          const url = URL.createObjectURL(videoBlob);
          setLocalVideoUrl(url);
      } else if (sessionData.videoUrl) {
          // Viewing past session
          setLocalVideoUrl(sessionData.videoUrl);
          setUploadStatus("success");
          setSessionId(sessionData._id); 
          setIsPublic(sessionData.isPublic || false);
          
          if (sessionData.transcript) {
              setTranscriptionData({
                  text: sessionData.transcript,
                  wpm: sessionData.wpm || 0,
                  fillers: sessionData.fillerCount || 0,
                  repetitive: sessionData.repetitiveWords || []
              });
          }
      }
  }, [videoBlob, sessionData]);

  // 2. Fetch Hall of Fame (Smart Filtering)
  useEffect(() => {
      const mode = sessionData.practiceMode || 'sitting';
      const title = sessionData.speechTitle || 'Free Practice';
      
      // Filter out the current session ID to avoid duplicates in the list
      const excludeParam = sessionId ? `&excludeId=${sessionId}` : '';

      fetch(`http://localhost:5000/api/sessions/top-rated?mode=${mode}&speechTitle=${title}${excludeParam}`)
        .then(res => res.json())
        .then(data => setTopSessions(data))
        .catch(err => console.error("Failed to fetch top sessions", err));
        
  }, [sessionData, isPublic, sessionId]);

  // 3. Process & Save Session (Parallel Execution)
  useEffect(() => {
    const processSession = async () => {
        if (!videoBlob || hasStartedProcessing.current) return;
        
        hasStartedProcessing.current = true;
        setUploadStatus("uploading");

        try {
            const formData = new FormData();
            formData.append("file", videoBlob);

            // A. Upload Video to Cloud (Promise 1)
            const uploadPromise = (async () => {
                const cloudData = new FormData();
                cloudData.append("file", videoBlob);
                cloudData.append("upload_preset", "gesture_app"); 
                const res = await fetch(`https://api.cloudinary.com/v1_1/dthpmbngj/video/upload`, { method: "POST", body: cloudData });
                return res.json();
            })();

            // B. Transcribe Audio on Server (Promise 2)
            const transcribePromise = fetch('http://localhost:5000/api/transcribe', {
                method: 'POST',
                body: formData
            }).then(res => res.json());

            // C. Wait for BOTH parallel tasks to finish
            const [cloudResult, transcribeResult] = await Promise.all([uploadPromise, transcribePromise]);

            setTranscriptionData({
                text: transcribeResult.transcript || "No speech detected.",
                wpm: transcribeResult.wpm || 0,
                fillers: transcribeResult.fillerCount || 0,
                repetitive: transcribeResult.repetitiveWords || []
            });

            // D. Save Metadata to Database
            const finalSessionData = { 
                ...sessionData, 
                userId: user.id,
                videoUrl: cloudResult.secure_url,
                transcript: transcribeResult.transcript,
                wpm: transcribeResult.wpm,
                fillerCount: transcribeResult.fillerCount,
                repetitiveWords: transcribeResult.repetitiveWords,
                isPublic: false 
            };
            
            const dbRes = await fetch('http://localhost:5000/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalSessionData),
            });

            if (dbRes.ok) {
                const savedSession = await dbRes.json();
                setSessionId(savedSession._id); 
                setUploadStatus("success");
            }

        } catch (error) {
            console.error("Error processing session:", error);
            setUploadStatus("error");
        }
    };

    processSession();
  }, [videoBlob, user, sessionData]);

  // Toggle Public/Private Status (Optimistic UI)
  const togglePublic = async () => {
      if (!sessionId) return;
      
      const newValue = !isPublic;
      setIsPublic(newValue); // Update UI immediately

      try {
          await fetch(`http://localhost:5000/api/sessions/${sessionId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isPublic: newValue })
          });
      } catch (err) {
          console.error("Failed to update public status", err);
          setIsPublic(!newValue); // Rollback on error
      }
  };

  return (
    <div style={{ backgroundColor: '#f8f9fa', height: '100%', overflowY: 'auto', paddingBottom: '40px' }}>
      
      {/* --- Header --- */}
      <div className="bg-white border-bottom py-4 mb-4 shadow-sm">
        <Container className="d-flex justify-content-between align-items-center">
            <div>
                <h2 style={{ fontWeight: '800', color: '#2c3e50', marginBottom: '5px' }}>Session Report</h2>
                <div className="text-muted d-flex align-items-center gap-2">
                    <Badge bg="dark">{sessionData.speechTitle}</Badge>
                    <Badge bg={sessionData.practiceMode === 'standing' ? 'success' : 'primary'}>
                        {sessionData.practiceMode === 'standing' ? 'Standing Mode' : 'Webcam Mode'}
                    </Badge>
                    • {new Date(sessionData.date).toLocaleDateString()}
                    
                    {uploadStatus === 'uploading' && <Badge bg="warning" text="dark">⏳ Saving...</Badge>}
                    {uploadStatus === 'success' && <Badge bg="success">✅ Saved</Badge>}
                </div>
            </div>
            <div className="text-end">
                <h1 style={{ fontSize: '3.5rem', fontWeight: '800', color: '#2c3e50', lineHeight: 1, marginBottom: 0 }}>
                    {sessionData.overallScore}<span style={{ fontSize: '1.5rem', color: '#ccc' }}>/100</span>
                </h1>
            </div>
        </Container>
      </div>

      <Container>
        <Row className="g-4">
            <Col lg={7}>
                {/* --- My Video --- */}
                <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                    {localVideoUrl ? (
                        <div style={{ width: '100%', height: '400px', backgroundColor: '#000' }}>
                            <video src={localVideoUrl} controls style={{ width: '100%', height: '100%' }} />
                        </div>
                    ) : ( <div className="p-5 text-center">No Video</div> )}
                </Card>

                {/* --- Hall of Fame --- */}
                {topSessions.length > 0 && (
                    <Card className="border-0 shadow-sm mb-4 bg-white" style={{ borderRadius: '20px' }}>
                        <Card.Header className="bg-transparent border-0 pt-4 px-4">
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 style={{ fontWeight: '800', margin: 0 }}>🏆 Hall of Fame: {sessionData.speechTitle}</h5>
                                <Badge bg="warning" text="dark">Top Performers</Badge>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <Row className="g-3">
                                {topSessions.map((session, idx) => (
                                    <Col key={session._id} md={4}>
                                        <Card 
                                            className="h-100 border-0 shadow-sm" 
                                            style={{ cursor: 'pointer', transition: '0.2s', backgroundColor: '#f8f9fa' }}
                                            onClick={() => setViewingVideo(session)}
                                        >
                                            <div className="position-relative" style={{ height: '100px', backgroundColor: '#000', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: '2rem' }}>▶️</span>
                                                <Badge bg="success" className="position-absolute top-0 end-0 m-2">{session.overallScore}</Badge>
                                            </div>
                                            <Card.Body className="p-2 text-center">
                                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{session.userName}</div>
                                                <small className="text-muted">{new Date(session.date).toLocaleDateString()}</small>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </Card.Body>
                    </Card>
                )}

                {/* --- Transcription --- */}
                <Card className="border-0 shadow-sm" style={{ borderRadius: '20px' }}>
                    <Card.Body className="p-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 style={{ fontWeight: '700', margin: 0 }}>🎙️ Transcript</h5>
                            {transcriptionData && (
                                <div className="d-flex gap-2">
                                    <Badge bg={getWpmFeedback(transcriptionData.wpm).color}>
                                        {transcriptionData.wpm} WPM
                                    </Badge>
                                    <Badge bg={transcriptionData.fillers > 1 ? "danger" : "success"}>
                                        {transcriptionData.fillers} Fillers
                                    </Badge>
                                </div>
                            )}
                        </div>
                        <div className="p-3 bg-light rounded mb-3" style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.95rem', lineHeight: '1.6' }}>
                            {transcriptionData ? transcriptionData.text : <div className="text-muted"><Spinner size="sm"/> Analyzing...</div>}
                        </div>
                    </Card.Body>
                </Card>
            </Col>

            <Col lg={5}>
                {/* --- AI Feedback & Share --- */}
                <Card className="border-0 shadow-sm mb-3" style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)' }}>
                    <Card.Body className="p-4">
                        <h5 style={{ fontWeight: '700', marginBottom: '15px' }}>AI Feedback</h5>
                        <p className="text-muted mb-4">{feedbackText}</p>
                        
                        {sessionData.overallScore > 0 && sessionId && (
                            <div className="bg-white p-3 rounded shadow-sm border d-flex align-items-center justify-content-between">
                                <div>
                                    <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>Share to Hall of Fame?</div>
                                    <small className="text-muted">Inspire others with your result</small>
                                </div>
                                <Form.Check 
                                    type="switch"
                                    id="public-switch"
                                    style={{ fontSize: '1.5rem' }}
                                    checked={isPublic}
                                    onChange={togglePublic}
                                />
                            </div>
                        )}
                    </Card.Body>
                </Card>

                <Card className="border-0 shadow-sm" style={{ borderRadius: '20px' }}>
                    <Card.Body className="p-4">
                        <h5 style={{ fontWeight: '700', marginBottom: '20px' }}>Visual Metrics</h5>
                        <MetricBar label="👁️ Eye Contact" value={sessionData.metrics.eyeContact} color="info" />
                        <MetricBar label="👐 Hands" value={sessionData.metrics.hands} color="warning" />
                        <MetricBar label="🔊 Volume" value={sessionData.metrics.volume} color="success" />
                        <MetricBar label="⚖️ Posture" value={sessionData.metrics.posture} color="primary" />
                    </Card.Body>
                </Card>

                <div className="d-flex gap-2 mt-4">
                    <Button variant="dark" className="w-100 rounded-pill" onClick={() => navigate('/practice')}>Practice Again</Button>
                    <Button variant="outline-secondary" className="w-100 rounded-pill" onClick={() => navigate('/profile')}>Profile</Button>
                </div>
            </Col>
        </Row>
      </Container>

      {/* --- Other Users' Video Modal --- */}
      <Modal show={!!viewingVideo} onHide={() => setViewingVideo(null)} size="lg" centered>
          <Modal.Header closeButton>
              <Modal.Title>{viewingVideo?.userName}'s Session</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-0 bg-black">
              {viewingVideo && (
                  <video src={viewingVideo.videoUrl} controls autoPlay style={{ width: '100%', maxHeight: '500px' }} />
              )}
          </Modal.Body>
          <Modal.Footer>
              <div className="d-flex gap-3 w-100 justify-content-center">
                  <Badge bg="success" style={{ fontSize: '1rem' }}>Score: {viewingVideo?.overallScore}</Badge>
              </div>
          </Modal.Footer>
      </Modal>

    </div>
  );
}

const MetricBar = ({ label, value, color }) => (
    <div className="mb-3">
        <div className="d-flex justify-content-between mb-1">
            <small className="fw-bold">{label}</small>
            <small>{value}%</small>
        </div>
        <ProgressBar now={value} variant={color} style={{ height: '6px' }} />
    </div>
);

export default SummaryPage;