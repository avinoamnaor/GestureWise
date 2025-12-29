import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, ProgressBar, Badge, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // מקבלים את הנתונים (realData מכיל עכשיו גם את videoUrl אם הגענו מהפרופיל)
  const { realData, videoBlob } = location.state || {};
  const [localVideoUrl, setLocalVideoUrl] = useState(null);
  
  const [uploadStatus, setUploadStatus] = useState("idle"); 
  const hasStartedUpload = useRef(false);

  const sessionData = realData || {
    date: new Date(),
    speechType: "Demo Practice",
    duration: "0:00",
    overallScore: 0,
    metrics: { eyeContact: 0, expression: 0, centering: 0, hands: 0, volume: 0, articulation: 0, posture: 0 }
  };

  const generateAIFeedback = (metrics) => {
    let feedback = [];
    if (metrics.eyeContact < 60) feedback.push("Try to look at the camera more often to build trust.");
    if (metrics.volume < 40) feedback.push("Your voice was a bit quiet. Don't be afraid to speak up!");
    if (metrics.hands < 50) feedback.push("Keep your hands visible and away from your face.");
    if (metrics.centering < 70) feedback.push("Try to stay in the center of the frame.");
    if (metrics.expression < 30) feedback.push("Try to smile more to engage your audience.");

    if (feedback.length === 0) return "Outstanding performance! Your delivery was balanced, clear, and engaging. Keep it up!";
    return `Good effort! Here are some tips for next time: ${feedback.slice(0, 2).join(" ")}`;
  };

  const feedbackText = generateAIFeedback(sessionData.metrics);

  // --- לוגיקת הצגת הוידאו (החלק ששונה) ---
  useEffect(() => {
      if (videoBlob) {
          // 1. אם יש הקלטה חדשה (הגענו מאימון כרגע) - נציג אותה
          const url = URL.createObjectURL(videoBlob);
          setLocalVideoUrl(url);
      } else if (sessionData.videoUrl) {
          // 2. אם אין הקלטה, אבל יש לינק (הגענו מהפרופיל) - נציג אותו!
          setLocalVideoUrl(sessionData.videoUrl);
          setUploadStatus("success"); // זה כבר שמור, אז נסמן V
      }
  }, [videoBlob, sessionData]);

  // --- לוגיקת העלאה (רצה רק אם יש הקלטה חדשה) ---
  useEffect(() => {
    const uploadAndSave = async () => {
        // אם אין וידאו חדש (blob), לא צריך להעלות כלום
        if (!videoBlob || !user || hasStartedUpload.current) return;
        
        hasStartedUpload.current = true;
        setUploadStatus("uploading");

        try {
            const formData = new FormData();
            formData.append("file", videoBlob);
            formData.append("upload_preset", "gesture_app"); 
            const cloudName = "dthpmbngj"; 
            
            const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
                method: "POST",
                body: formData
            });
            
            if (!cloudRes.ok) throw new Error("Cloudinary upload failed");
            
            const cloudData = await cloudRes.json();
            const videoUrl = cloudData.secure_url;
            console.log("✅ Video uploaded successfully:", videoUrl);

            const finalSessionData = { ...sessionData, videoUrl: videoUrl };
            
            const dbRes = await fetch('http://localhost:5000/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalSessionData),
            });

            if (dbRes.ok) {
                setUploadStatus("success");
                console.log("✅ Session saved to DB!");
            }

        } catch (error) {
            console.error("Error during upload/save:", error);
            setUploadStatus("error");
        }
    };

    uploadAndSave();
  }, [videoBlob, user, sessionData]);

  return (
    <div style={{ backgroundColor: '#f8f9fa', height: '100%', overflowY: 'auto', paddingBottom: '40px' }}>
      
      <div className="bg-white border-bottom py-4 mb-4 shadow-sm">
        <Container className="d-flex justify-content-between align-items-center">
            <div>
                <h2 style={{ fontWeight: '800', color: '#2c3e50', marginBottom: '5px' }}>Session Report</h2>
                <div className="text-muted d-flex align-items-center gap-2">
                    {sessionData.speechType} • {new Date(sessionData.date).toLocaleDateString()}
                    
                    {/* תצוגת סטטוס חכמה */}
                    {uploadStatus === 'uploading' && <Badge bg="light" text="dark" className="border">☁️ Saving video...</Badge>}
                    {uploadStatus === 'success' && <Badge bg="success">✅ Saved / Archived</Badge>}
                    {uploadStatus === 'error' && <Badge bg="danger">⚠️ Not Saved</Badge>}
                    {/* אם אין וידאו בכלל */}
                    {uploadStatus === 'idle' && !localVideoUrl && <Badge bg="secondary">No Video</Badge>}
                </div>
            </div>
            <div className="text-end">
                <h1 style={{ fontSize: '3.5rem', fontWeight: '800', color: '#2c3e50', lineHeight: 1, marginBottom: 0 }}>
                    {sessionData.overallScore}<span style={{ fontSize: '1.5rem', color: '#ccc' }}>/100</span>
                </h1>
                <Badge bg={sessionData.overallScore >= 80 ? "success" : sessionData.overallScore >= 60 ? "warning" : "danger"} pill>
                    {sessionData.overallScore >= 80 ? "Excellent!" : sessionData.overallScore >= 60 ? "Good Job" : "Keep Practicing"}
                </Badge>
            </div>
        </Container>
      </div>

      <Container>
        <Row className="g-4">
            <Col lg={7}>
                <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                    {localVideoUrl ? (
                        <div style={{ width: '100%', height: '450px', backgroundColor: '#000', position: 'relative' }}>
                            <video src={localVideoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            {uploadStatus === 'uploading' && (
                                <div style={{ position: 'absolute', top: 15, right: 15 }}>
                                    <Spinner animation="border" variant="light" size="sm" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ backgroundColor: '#000', height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <div style={{ fontSize: '2rem' }}>🚫</div>
                            <h5 className="mb-0 mt-2">No Video Available</h5>
                        </div>
                    )}
                    <Card.Body className="p-4">
                        <h5 style={{ fontWeight: '700' }}>AI Feedback Summary</h5>
                        <p className="text-muted" style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
                            {feedbackText}
                        </p>
                    </Card.Body>
                </Card>
            </Col>

            <Col lg={5}>
                <Card className="border-0 shadow-sm" style={{ borderRadius: '20px' }}>
                    <Card.Body className="p-4">
                        <h5 style={{ fontWeight: '700', marginBottom: '25px' }}>AI Analysis Metrics</h5>
                        <MetricBar label="👁️ Eye Contact" value={sessionData.metrics.eyeContact} color="info" />
                        <MetricBar label="👐 Hands & Gestures" value={sessionData.metrics.hands} color="warning" />
                        <MetricBar label="⚖️ Posture & Stability" value={sessionData.metrics.posture} color="primary" />
                        <MetricBar label="🔊 Clarity & Volume" value={sessionData.metrics.volume} color="success" />
                        <MetricBar label="😃 Facial Expression" value={sessionData.metrics.expression} color="danger" />
                        <MetricBar label="🎯 Centering" value={sessionData.metrics.centering} color="secondary" />
                    </Card.Body>
                </Card>

                <div className="d-flex gap-3 mt-4 mb-4">
                    <Button variant="dark" size="lg" className="w-100 shadow-sm" style={{ borderRadius: '50px' }} onClick={() => navigate('/practice')}>
                        Try Again 🎤
                    </Button>
                    <Button variant="outline-secondary" size="lg" className="w-100" style={{ borderRadius: '50px' }} onClick={() => navigate(user ? '/profile' : '/')}>
                        {user ? "Go to Profile" : "Back Home"}
                    </Button>
                </div>
            </Col>
        </Row>
      </Container>
    </div>
  );
}

const MetricBar = ({ label, value, color }) => (
    <div className="mb-4">
        <div className="d-flex justify-content-between mb-1">
            <span style={{ fontWeight: '600', color: '#555' }}>{label}</span>
            <span style={{ fontWeight: '700' }}>{value}%</span>
        </div>
        <ProgressBar now={value} variant={color} style={{ height: '8px', borderRadius: '10px' }} />
    </div>
);

export default SummaryPage;