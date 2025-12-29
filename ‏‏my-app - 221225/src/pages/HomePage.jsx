import React from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import heroSpeakerImg from '../assets/hero-speaker.png'; 

function HomePage() {
  const navigate = useNavigate();

  const buttonStyle = {
    borderRadius: '50px', padding: '10px 30px', border: '1.5px solid #333', 
    backgroundColor: 'transparent', color: '#333', fontWeight: '600',
    fontSize: '0.9rem', marginTop: '15px'
  };

  const cardStyle = {
    borderRadius: '20px', 
    border: 'none', textAlign: 'center',
    padding: '20px', 
    height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: '600', fontSize: '1.1rem', color: '#4A4A4A' 
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* --- SECTION 1: HERO (75%) --- */}
      {/* הגדלנו את הגובה ל-75% כדי שהרקע ירד למטה קרוב לכרטיסים */}
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
              <Button 
                variant="light" style={buttonStyle} onClick={() => navigate('/practice')}
                className="hover-effect"
              >
                start live practice
              </Button>
            </Col>
            <Col lg={6} className="text-center d-none d-lg-block">
              <img 
                src={heroSpeakerImg} alt="Speaker" className="img-fluid"
                // התאמנו את גובה התמונה שיתאים לחלל החדש
                style={{ maxHeight: '45vh', objectFit: 'contain' }} 
              />
            </Col>
          </Row>
        </Container>
      </div>

      {/* --- SECTION 2: CARDS (25%) --- */}
      {/* הקטנו את החלק התחתון ל-25% */}
      <div className="bg-white d-flex align-items-center" style={{ height: '25%' }}>
        <Container>
          <Row className="justify-content-center w-100 g-4"> 
            
            <Col md={4} className="mb-2">
              <Card style={cardStyle} className="bg-card-custom shadow-sm hover-effect h-100">
                <Card.Text>practice with<br />our speeches</Card.Text>
              </Card>
            </Col>
            
            <Col md={4} className="mb-2">
              <Card style={cardStyle} className="bg-card-custom shadow-sm hover-effect h-100">
                <Card.Text>practice with<br />your speech</Card.Text>
              </Card>
            </Col>
            
            <Col md={4} className="mb-2">
              <Card style={cardStyle} className="bg-card-custom shadow-sm hover-effect h-100">
                <Card.Text>practice with<br />your speech</Card.Text>
              </Card>
            </Col>
            
          </Row>
        </Container>
      </div>

    </div>
  );
}

export default HomePage;