import React, { useState } from 'react';
import { Container, Row, Col, Button, Card, Modal, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import heroSpeakerImg from '../assets/hero-speaker.png'; 

function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth(); // בדיקת המשתמש המחובר

  // State למודל של נאום אישי
  const [showSpeechModal, setShowSpeechModal] = useState(false);
  const [customSpeechTitle, setCustomSpeechTitle] = useState('');
  const [customSpeechText, setCustomSpeechText] = useState('');

  // סגנונות
  const cardStyle = {
    borderRadius: '20px', 
    border: 'none', textAlign: 'center',
    padding: '20px', 
    height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: '700', fontSize: '1.2rem', color: '#4A4A4A', cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s'
  };

  // פונקציית עזר לבדיקת התחברות
  const handleAuthCheck = (action) => {
    if (user) {
      action();
    } else {
      alert("Please log in or sign up to use this feature! 🔒");
    }
  };

  // התחלת אימון עם נאום אישי
  const startCustomSession = () => {
      if (!customSpeechText.trim()) return alert("Please enter some text");
      
      navigate('/practice', { 
          state: { 
              speechText: customSpeechText,
              speechTitle: customSpeechTitle || "My Custom Speech"
          } 
      });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* --- Hero Section (75%) --- */}
      <div className="bg-cream d-flex align-items-center" style={{ height: '75%' }}>
        <Container>
          <Row className="align-items-center">
            <Col lg={6} className="text-start">
              <h1 style={{ fontWeight: '800', fontSize: '3.5rem', lineHeight: '1.1', marginBottom: '0.5rem' }}>
                Your personal public <br /> speaking guide
              </h1>
              <p className="text-muted mb-3" style={{ fontSize: '1.1rem', maxWidth: '480px' }}>
                Using our suggested speeches or your own, practice 
                live to get feedback on your speaking ability.
              </p>
            </Col>
            <Col lg={6} className="text-center d-none d-lg-block">
              <img 
                src={heroSpeakerImg} alt="Speaker" className="img-fluid"
                style={{ maxHeight: '45vh', objectFit: 'contain' }} 
              />
            </Col>
          </Row>
        </Container>
      </div>

      {/* --- Cards Section (25%) --- */}
      <div className="bg-white d-flex align-items-center" style={{ height: '25%' }}>
        <Container>
          <Row className="justify-content-center w-100 g-4"> 
            
            {/* כרטיס 1: אימון מהיר (עכשיו ראשון!) */}
            <Col md={4}>
              <Card 
                style={cardStyle} 
                className="bg-card-custom shadow-sm hover-effect h-100"
                onClick={() => navigate('/practice')}
              >
                <Card.Text>start live<br />practice 🎤</Card.Text>
              </Card>
            </Col>

            {/* כרטיס 2: נאומי המערכת */}
            <Col md={4}>
              <Card 
                style={cardStyle} 
                className="bg-card-custom shadow-sm hover-effect h-100"
                onClick={() => navigate('/speeches')}
              >
                <Card.Text>practice with<br />our speeches 📚</Card.Text>
              </Card>
            </Col>
            
            {/* כרטיס 3: נאום שלך (מוגן ע"י התחברות) */}
            <Col md={4}>
              <Card 
                style={cardStyle} 
                className="bg-card-custom shadow-sm hover-effect h-100"
                onClick={() => handleAuthCheck(() => setShowSpeechModal(true))}
              >
                <Card.Text>practice with<br />your speech 📝</Card.Text>
              </Card>
            </Col>
            
          </Row>
        </Container>
      </div>

      {/* --- Modal להזנת נאום אישי --- */}
      <Modal show={showSpeechModal} onHide={() => setShowSpeechModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Practice Your Speech</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form>
                <Form.Group className="mb-3">
                    <Form.Label>Speech Title (Optional)</Form.Label>
                    <Form.Control 
                        type="text" 
                        placeholder="e.g., Wedding Toast, Project Pitch" 
                        value={customSpeechTitle}
                        onChange={(e) => setCustomSpeechTitle(e.target.value)}
                    />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Paste Your Script</Form.Label>
                    <Form.Control 
                        as="textarea" 
                        rows={8} 
                        placeholder="Paste your speech text here..." 
                        value={customSpeechText}
                        onChange={(e) => setCustomSpeechText(e.target.value)}
                    />
                </Form.Group>
            </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSpeechModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={startCustomSession} disabled={!customSpeechText.trim()}>
            Start Practice
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
}

export default HomePage;