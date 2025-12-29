import React from 'react';
import { Container, Row, Col, Card, Button, ProgressBar, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

function SummaryPage() {
  const navigate = useNavigate();

  // נתונים לדוגמה (בהמשך יגיעו מהאלגוריתם)
  const sessionData = {
    speechTitle: "Steve Jobs Stanford Speech",
    date: "Dec 04, 2025 • 10:30 AM",
    duration: "03:12",
    overallScore: 8.7,
    videoUrl: "", // כאן יהיה ה-Blob של הוידאו
    metrics: {
      eyeContact: 85,
      handGestures: 70,
      pacing: 92,
      clarity: 88
    },
    feedback: {
      good: ["Excellent pacing! You spoke clearly and calmly.", "Great eye contact throughout the intro."],
      improvements: ["Try to use more open hand gestures.", "You looked down at your notes 4 times."]
    }
  };

  return (
    <div style={{ minHeight: '100%', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
      
      {/* --- Header --- */}
      <div className="bg-cream py-4 border-bottom">
        <Container>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 style={{ fontWeight: '800', color: '#333' }}>Session Report</h2>
              <p className="text-muted mb-0">{sessionData.speechTitle} • {sessionData.date}</p>
            </div>
            <div className="text-end">
               <h1 style={{ fontSize: '3.5rem', fontWeight: '800', color: '#2c3e50', marginBottom: 0, lineHeight: 1 }}>
                 {sessionData.overallScore}
                 <span style={{ fontSize: '1.5rem', color: '#888', fontWeight: '400' }}>/10</span>
               </h1>
               <Badge bg="success" pill>Great Job!</Badge>
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-4">
        <Row className="g-4">
          
          {/* --- צד שמאל: וידאו וניתוח --- */}
          <Col lg={7}>
            
            {/* נגן וידאו (Placeholder) */}
            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '20px', overflow: 'hidden' }}>
              <div style={{ aspectRatio: '16/9', backgroundColor: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'white', textAlign: 'center' }}>
                   {/* כפתור Play מזויף */}
                   <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', cursor: 'pointer' }}>
                     ▶
                   </div>
                   <p className="mb-0">Watch Replay ({sessionData.duration})</p>
                </div>
              </div>
            </Card>

            {/* פידבק מילולי */}
            <Row>
               <Col md={6} className="mb-3">
                 <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '15px', borderLeft: '5px solid #28a745' }}>
                   <Card.Body>
                     <h6 style={{ fontWeight: '700', color: '#28a745' }}>What went well 👍</h6>
                     <ul className="mb-0 ps-3 text-muted small mt-2">
                       {sessionData.feedback.good.map((item, i) => <li key={i} className="mb-1">{item}</li>)}
                     </ul>
                   </Card.Body>
                 </Card>
               </Col>
               <Col md={6} className="mb-3">
                 <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '15px', borderLeft: '5px solid #ffc107' }}>
                   <Card.Body>
                     <h6 style={{ fontWeight: '700', color: '#ffc107' }}>Things to improve 💡</h6>
                     <ul className="mb-0 ps-3 text-muted small mt-2">
                       {sessionData.feedback.improvements.map((item, i) => <li key={i} className="mb-1">{item}</li>)}
                     </ul>
                   </Card.Body>
                 </Card>
               </Col>
            </Row>

          </Col>

          {/* --- צד ימין: מדדים --- */}
          <Col lg={5}>
            <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '20px' }}>
              <Card.Body className="p-4">
                <h5 style={{ fontWeight: '700', marginBottom: '20px' }}>AI Analysis</h5>
                
                {/* מדד 1 */}
                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontWeight: '500' }}>👁️ Eye Contact</span>
                    <span style={{ fontWeight: '700' }}>{sessionData.metrics.eyeContact}%</span>
                  </div>
                  <ProgressBar now={sessionData.metrics.eyeContact} variant="info" style={{ height: '10px', borderRadius: '10px' }} />
                  <small className="text-muted">You maintained good focus on the audience.</small>
                </div>

                {/* מדד 2 */}
                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontWeight: '500' }}>👋 Hand Gestures</span>
                    <span style={{ fontWeight: '700' }}>{sessionData.metrics.handGestures}%</span>
                  </div>
                  <ProgressBar now={sessionData.metrics.handGestures} variant="warning" style={{ height: '10px', borderRadius: '10px' }} />
                  <small className="text-muted">Try to keep your hands visible.</small>
                </div>

                {/* מדד 3 */}
                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontWeight: '500' }}>⏱️ Pacing & Speed</span>
                    <span style={{ fontWeight: '700' }}>{sessionData.metrics.pacing}%</span>
                  </div>
                  <ProgressBar now={sessionData.metrics.pacing} variant="success" style={{ height: '10px', borderRadius: '10px' }} />
                  <small className="text-muted">Perfect speed, very easy to follow.</small>
                </div>

                <hr className="my-4" />

                <div className="d-grid gap-2">
                  <Button variant="dark" size="lg" style={{ borderRadius: '50px' }} onClick={() => navigate('/practice')}>
                    Practice Again
                  </Button>
                  <Button variant="outline-secondary" size="lg" style={{ borderRadius: '50px' }} onClick={() => navigate('/speeches')}>
                    Choose Another Speech
                  </Button>
                </div>

              </Card.Body>
            </Card>
          </Col>
        </Row>
        <div className="pb-5"></div>
      </Container>
    </div>
  );
}

export default SummaryPage;