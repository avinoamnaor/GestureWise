import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, ProgressBar, Badge, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { realData, videoBlob } = location.state || {};
  const [localVideoUrl, setLocalVideoUrl] = useState(null);
  
  const [uploadStatus, setUploadStatus] = useState("idle"); 
  const hasStartedProcessing = useRef(false);

  // סטייט לנתוני התמלול
  const [transcriptionData, setTranscriptionData] = useState(null);

  // === פונקציית עזר: תרגום קצב דיבור למילים ===
  const getWpmFeedback = (wpm) => {
      if (!wpm) return { text: "Analyzing...", color: "secondary" };
      const speed = parseFloat(wpm);
      if (speed < 100) return { text: "Too Slow 🐢", color: "warning" };
      if (speed > 160) return { text: "Too Fast 🐇", color: "danger" };
      return { text: "Perfect Pace 🎯", color: "success" };
  };

  // === 1. שער כניסה: אם אין משתמש, חוסמים הכל ===
  if (!user) {
      return (
        <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: '100vh', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
            <div className="bg-white p-5 shadow-sm" style={{ borderRadius: '20px', maxWidth: '500px' }}>
                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🔒</div>
                <h2 style={{ fontWeight: '800', color: '#2c3e50' }}>Login Required</h2>
                <p className="text-muted mb-4">
                    You've completed a practice session! <br/>
                    To view your video, analysis metrics, and speech transcript, you need to be logged in.
                </p>
                <div className="d-flex flex-column gap-3">
                    <Button variant="primary" size="lg" className="rounded-pill w-100" onClick={() => navigate('/login')}>
                        Log In to Account
                    </Button>
                    <Button variant="outline-dark" size="lg" className="rounded-pill w-100" onClick={() => navigate('/register')}>
                        Create Free Account
                    </Button>
                    <Button variant="link" className="text-muted text-decoration-none mt-2" onClick={() => navigate('/')}>
                        Back to Home
                    </Button>
                </div>
            </div>
        </div>
      );
  }

  // === מכאן והלאה - הקוד רץ רק למשתמשים מחוברים ===

  const sessionData = realData || {
    date: new Date(),
    speechType: "Demo Practice",
    duration: "0:00",
    overallScore: 0,
    metrics: { eyeContact: 0, expression: 0, centering: 0, hands: 0, volume: 0, articulation: 0, posture: 0 }
  };

  const generateAIFeedback = (metrics) => {
    let feedback = [];
    if (metrics.eyeContact < 60) feedback.push("Try to look at the camera more often.");
    if (metrics.volume < 40) feedback.push("Speak louder!");
    if (metrics.hands < 50) feedback.push("Use more hand gestures.");
    if (feedback.length === 0) return "Outstanding performance! Keep it up!";
    return `Tips: ${feedback.slice(0, 2).join(" ")}`;
  };

  const feedbackText = generateAIFeedback(sessionData.metrics);

  // תצוגת וידאו והכנת נתונים
  useEffect(() => {
      if (videoBlob) {
          const url = URL.createObjectURL(videoBlob);
          setLocalVideoUrl(url);
      } else if (sessionData.videoUrl) {
          setLocalVideoUrl(sessionData.videoUrl);
          setUploadStatus("success");
          
          if (sessionData.transcript) {
              setTranscriptionData({
                  text: sessionData.transcript,
                  wpm: sessionData.wpm || 0,
                  fillers: sessionData.fillerCount || 0
              });
          }
      }
  }, [videoBlob, sessionData]);

  // לוגיקת העלאה וניתוח (רצה בוודאות רק למשתמשים מחוברים)
  useEffect(() => {
    const processSession = async () => {
        if (!videoBlob || hasStartedProcessing.current) return;
        
        hasStartedProcessing.current = true;
        setUploadStatus("uploading");

        try {
            const formData = new FormData();
            formData.append("file", videoBlob);

            // 1. העלאה לקלאוד
            const uploadPromise = (async () => {
                const cloudData = new FormData();
                cloudData.append("file", videoBlob);
                cloudData.append("upload_preset", "gesture_app"); 
                const res = await fetch(`https://api.cloudinary.com/v1_1/dthpmbngj/video/upload`, { method: "POST", body: cloudData });
                return res.json();
            })();

            // 2. תמלול בשרת
            const transcribePromise = fetch('http://localhost:5000/api/transcribe', {
                method: 'POST',
                body: formData
            }).then(res => res.json());

            const [cloudResult, transcribeResult] = await Promise.all([uploadPromise, transcribePromise]);

            setTranscriptionData({
                text: transcribeResult.transcript || "No speech detected.",
                wpm: transcribeResult.wpm || 0,
                fillers: transcribeResult.fillerCount || 0
            });

            // 3. שמירה לדאטה בייס
            const finalSessionData = { 
                ...sessionData, 
                userId: user.id,
                videoUrl: cloudResult.secure_url,
                transcript: transcribeResult.transcript,
                wpm: transcribeResult.wpm,
                fillerCount: transcribeResult.fillerCount
            };
            
            const dbRes = await fetch('http://localhost:5000/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalSessionData),
            });

            if (dbRes.ok) setUploadStatus("success");

        } catch (error) {
            console.error("Error processing session:", error);
            setUploadStatus("error");
        }
    };

    processSession();
  }, [videoBlob, user, sessionData]);

  return (
    <div style={{ backgroundColor: '#f8f9fa', height: '100%', overflowY: 'auto', paddingBottom: '40px' }}>
      
      <div className="bg-white border-bottom py-4 mb-4 shadow-sm">
        <Container className="d-flex justify-content-between align-items-center">
            <div>
                <h2 style={{ fontWeight: '800', color: '#2c3e50', marginBottom: '5px' }}>Session Report</h2>
                <div className="text-muted d-flex align-items-center gap-2">
                    {sessionData.speechType} • {new Date(sessionData.date).toLocaleDateString()}
                    
                    {uploadStatus === 'uploading' && <Badge bg="warning" text="dark">⏳ Analyzing & Saving...</Badge>}
                    {uploadStatus === 'success' && <Badge bg="success">✅ Saved</Badge>}
                    {uploadStatus === 'error' && <Badge bg="danger">⚠️ Error Saving</Badge>}
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
                {/* וידאו */}
                <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                    {localVideoUrl ? (
                        <div style={{ width: '100%', height: '400px', backgroundColor: '#000' }}>
                            <video src={localVideoUrl} controls style={{ width: '100%', height: '100%' }} />
                        </div>
                    ) : (
                        <div className="p-5 text-center">No Video</div>
                    )}
                </Card>

                {/* תמלול וניתוח שפה */}
                <Card className="border-0 shadow-sm" style={{ borderRadius: '20px' }}>
                    <Card.Body className="p-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 style={{ fontWeight: '700', margin: 0 }}>🎙️ Speech Transcript</h5>
                            {transcriptionData && (
                                <div className="d-flex gap-2">
                                    {/* שימוש בפונקציה החדשה להצגת טקסט במקום מספר */}
                                    <Badge bg={getWpmFeedback(transcriptionData.wpm).color}>
                                        {getWpmFeedback(transcriptionData.wpm).text} ({transcriptionData.wpm} WPM)
                                    </Badge>
                                    
                                    <Badge bg={transcriptionData.fillers > 3 ? "danger" : "success"}>
                                        🤔 {transcriptionData.fillers} Fillers
                                    </Badge>
                                </div>
                            )}
                        </div>
                        <div className="p-3 bg-light rounded" style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.95rem', lineHeight: '1.6' }}>
                            {transcriptionData ? transcriptionData.text : <div className="text-muted"><Spinner size="sm"/> Analyzing...</div>}
                        </div>
                    </Card.Body>
                </Card>
            </Col>

            <Col lg={5}>
                {/* מדדים */}
                <Card className="border-0 shadow-sm mb-3" style={{ borderRadius: '20px' }}>
                    <Card.Body className="p-4">
                        <h5 style={{ fontWeight: '700', marginBottom: '20px' }}>AI Feedback</h5>
                        <p className="text-muted">{feedbackText}</p>
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