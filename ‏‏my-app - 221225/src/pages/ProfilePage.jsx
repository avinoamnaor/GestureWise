import React from 'react';
import { Container, Row, Col, Card, Button, ProgressBar, Badge } from 'react-bootstrap';

function ProfilePage() {
  // נתונים לדוגמה (בהמשך יגיעו מהשרת)
  const userStats = {
    name: "Avinoam Student",
    level: "Intermediate Speaker",
    totalSpeeches: 12,
    avgScore: 8.5,
    streak: 5
  };

  const recentPractices = [
    { id: 1, date: "02/12/2025", title: "Steve Jobs Stanford Speech", score: 9.2, feedback: "Great eye contact!" },
    { id: 2, date: "28/11/2025", title: "Elevator Pitch", score: 7.8, feedback: "Try to move your hands more." },
    { id: 3, date: "20/11/2025", title: "Wedding Toast", score: 8.5, feedback: "Good pacing, very clear." },
  ];

  return (
    <div style={{ minHeight: '100%', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
      
      {/* --- חלק עליון: פרטי משתמש --- */}
      <div className="bg-cream py-5 border-bottom">
        <Container>
          <Row className="align-items-center">
            {/* תמונה/אווטאר */}
            <Col md={2} className="text-center text-md-start mb-3 mb-md-0">
              <div style={{ 
                width: '100px', height: '100px', 
                backgroundColor: '#FFE4D6', 
                borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.5rem', fontWeight: 'bold', color: '#333',
                margin: '0 auto'
              }}>
                AS
              </div>
            </Col>
            
            {/* שם וסטטוס */}
            <Col md={6} className="text-center text-md-start">
              <h2 style={{ fontWeight: '800', color: '#333' }}>{userStats.name}</h2>
              <p className="text-muted mb-2">{userStats.level}</p>
              <Badge bg="success" pill className="px-3 py-2">
                🔥 {userStats.streak} Day Streak
              </Badge>
            </Col>

            {/* סטטיסטיקה מהירה */}
            <Col md={4} className="mt-4 mt-md-0">
              <Card className="border-0 shadow-sm" style={{ borderRadius: '15px' }}>
                <Card.Body className="d-flex justify-content-around text-center">
                  <div>
                    <h3 style={{ fontWeight: 'bold', marginBottom: '0' }}>{userStats.totalSpeeches}</h3>
                    <small className="text-muted">Speeches</small>
                  </div>
                  <div style={{ borderLeft: '1px solid #eee' }}></div>
                  <div>
                    <h3 style={{ fontWeight: 'bold', marginBottom: '0' }}>{userStats.avgScore}</h3>
                    <small className="text-muted">Avg. Score</small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      {/* --- חלק תחתון: היסטוריה --- */}
      <Container className="py-5">
        <h4 style={{ fontWeight: '700', marginBottom: '20px' }}>Recent Activity</h4>
        
        <Row>
          <Col lg={8}>
            {/* רשימת האימונים */}
            {recentPractices.map((practice) => (
              <Card key={practice.id} className="mb-3 border-0 shadow-sm hover-effect" style={{ borderRadius: '15px' }}>
                <Card.Body className="d-flex align-items-center justify-content-between p-4">
                  
                  <div>
                    <h5 style={{ fontWeight: '600', marginBottom: '5px' }}>{practice.title}</h5>
                    <p className="text-muted small mb-0">{practice.date} • {practice.feedback}</p>
                  </div>

                  <div className="text-end">
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: practice.score >= 9 ? '#28a745' : '#ffc107' }}>
                      {practice.score}
                    </div>
                    <small className="text-muted">Score</small>
                  </div>

                </Card.Body>
              </Card>
            ))}
          </Col>

          {/* צד ימין: גרף התקדמות (דאמי) */}
          <Col lg={4}>
            <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '15px', minHeight: '200px' }}>
              <Card.Body>
                <h5 style={{ fontWeight: '600' }}>Skills Progress</h5>
                <hr />
                
                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <small>Eye Contact</small> <small>85%</small>
                  </div>
                  <ProgressBar now={85} variant="info" style={{ height: '8px', borderRadius: '10px' }} />
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <small>Hand Gestures</small> <small>60%</small>
                  </div>
                  <ProgressBar now={60} variant="warning" style={{ height: '8px', borderRadius: '10px' }} />
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <small>Confidence</small> <small>92%</small>
                  </div>
                  <ProgressBar now={92} variant="success" style={{ height: '8px', borderRadius: '10px' }} />
                </div>

              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

    </div>
  );
}

export default ProfilePage;