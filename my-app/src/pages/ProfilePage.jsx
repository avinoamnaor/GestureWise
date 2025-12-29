import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Button, ProgressBar, Badge, Spinner, Alert } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const StatCard = ({ title, value, subtext }) => (
  <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '15px' }}>
    <Card.Body className="text-center d-flex flex-column justify-content-center py-4">
      <h3 style={{ fontWeight: '800', color: '#2c3e50', fontSize: '2.5rem' }}>{value}</h3>
      <div className="text-muted text-uppercase small" style={{ letterSpacing: '1px' }}>{title}</div>
      {subtext && <small className="text-success mt-2 fw-bold">{subtext}</small>}
    </Card.Body>
  </Card>
);

const SkillBar = ({ label, percentage, color, icon }) => (
  <div className="mb-4">
    <div className="d-flex justify-content-between mb-2 align-items-center">
      <span className="d-flex align-items-center gap-2">
        <span style={{ fontSize: '1.2rem' }}>{icon}</span> 
        <span style={{ fontWeight: '600', color: '#555' }}>{label}</span>
      </span>
      <span className="badge bg-light text-dark border">{percentage}%</span>
    </div>
    <ProgressBar now={percentage} variant={color} style={{ height: '10px', borderRadius: '10px' }} />
  </div>
);

const PracticeItem = ({ title, date, score, feedback, onClick }) => (
  <Card className="mb-3 border-0 shadow-sm" style={{ borderRadius: '15px', overflow: 'hidden' }}>
    <Card.Body className="d-flex flex-column flex-md-row align-items-center justify-content-between p-4">
      
      <div className="d-flex align-items-center mb-3 mb-md-0 w-100">
        <div className="me-3 d-flex align-items-center justify-content-center bg-light rounded-circle" style={{ width: '50px', height: '50px', fontSize: '1.5rem' }}>
          🎤
        </div>
        <div>
          <h5 style={{ fontWeight: '700', marginBottom: '4px', color: '#333' }}>{title}</h5>
          <div className="text-muted small">
            📅 {date} &nbsp;|&nbsp; 💬 {feedback}
          </div>
        </div>
      </div>

      <div className="d-flex align-items-center gap-4 w-100 w-md-auto justify-content-between justify-content-md-end mt-3 mt-md-0">
        <div className="text-center px-3">
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: score >= 9 ? '#198754' : '#ffc107', lineHeight: 1 }}>
            {score}
          </div>
          <small className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Score</small>
        </div>

        <div className="d-flex gap-2">
            {/* הכפתור עם הטקסט המעודכן */}
            <Button 
                variant="outline-primary" 
                className="px-4 py-2" 
                style={{ borderRadius: '25px', fontWeight: '600' }} 
                onClick={onClick}
            >
                View Analysis
            </Button>
        </div>
      </div>
    </Card.Body>
  </Card>
);

function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({ totalSpeeches: 0, avgScore: 0, streak: 0 });
  const [skills, setSkills] = useState({ eyeContact: 0, hands: 0, posture: 0, volume: 0 });
  const [smartTip, setSmartTip] = useState("Start practicing to get personalized tips!");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetch(`http://localhost:5000/api/sessions?userId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        setSessions(data);
        
        if (data.length > 0) {
          const totalScore = data.reduce((sum, session) => sum + (session.overallScore || 0), 0);
          const average = (totalScore / data.length).toFixed(1);
          setStats({ totalSpeeches: data.length, avgScore: average, streak: 3 });

          let sumEye = 0, sumHands = 0, sumPosture = 0, sumVolume = 0;
          data.forEach(session => {
            const m = session.metrics || {};
            sumEye += m.eyeContact || 0;
            sumHands += m.hands || 0;
            sumPosture += m.posture || 0;
            sumVolume += m.volume || 0;
          });

          const avgSkills = {
            eyeContact: Math.round(sumEye / data.length),
            hands: Math.round(sumHands / data.length),
            posture: Math.round(sumPosture / data.length),
            volume: Math.round(sumVolume / data.length)
          };
          setSkills(avgSkills);

          const lowestSkill = Object.keys(avgSkills).reduce((a, b) => avgSkills[a] < avgSkills[b] ? a : b);
          switch (lowestSkill) {
            case 'eyeContact': setSmartTip("Focus on maintaining Eye Contact."); break;
            case 'hands': setSmartTip("Try using more Hand Gestures."); break;
            case 'posture': setSmartTip("Check your Posture."); break;
            case 'volume': setSmartTip("Speak up! Work on your Volume."); break;
            default: setSmartTip("Great job! Keep practicing.");
          }
        } else {
            setStats({ totalSpeeches: 0, avgScore: 0, streak: 0 });
            setSkills({ eyeContact: 0, hands: 0, posture: 0, volume: 0 });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching sessions:", err);
        setLoading(false);
      });
  }, [user]);

  const handleAnalysisClick = (session) => {
    // מעבירים את כל הנתונים, כולל הוידאו, לדף הסיכום
    navigate('/summary', { state: { realData: session } });
  };

  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}><Spinner animation="border" variant="primary" /></div>;

  if (!user) {
    return (
        <Container className="text-center mt-5">
            <Alert variant="warning">
                <h4>You are not logged in</h4>
                <p>Please log in to view your profile and history.</p>
                <Link to="/login"><Button variant="dark">Log In</Button></Link>
            </Alert>
        </Container>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 60px)', overflowY: 'auto', backgroundColor: '#f0f2f5', fontFamily: 'Segoe UI, sans-serif' }}>
      
      <div className="bg-white pb-5 pt-5 border-bottom mb-5">
        <Container>
          <Row className="align-items-center">
            <Col md={7} className="d-flex align-items-center mb-4 mb-md-0">
              <div style={{ 
                width: '110px', height: '110px', backgroundColor: '#FFE4D6', borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.5rem', fontWeight: 'bold', color: '#555', marginRight: '25px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}>
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div>
                <h1 style={{ fontWeight: '800', color: '#2c3e50', fontSize: '2.5rem' }}>{user.name}</h1>
                <div className="d-flex align-items-center gap-3 mt-2">
                  <Badge bg="secondary" className="px-3 py-2">Intermediate Speaker</Badge>
                  <Badge bg="success" pill className="px-3 py-2">🔥 {stats.streak} Day Streak</Badge>
                </div>
              </div>
            </Col>
            <Col md={5}>
              <Row className="g-3">
                <Col xs={6}><StatCard title="Total Speeches" value={stats.totalSpeeches} /></Col>
                <Col xs={6}><StatCard title="Avg. Score" value={stats.avgScore} subtext="Lifetime Avg 🏆" /></Col>
              </Row>
            </Col>
          </Row>
        </Container>
      </div>

      <Container className="pb-5">
        <Row className="gy-4">
          <Col lg={8}>
            <div className="d-flex justify-content-between align-items-end mb-4">
              <div><h4 style={{ fontWeight: '800', color: '#333' }}>Recent Activity</h4><p className="text-muted mb-0">Your personal history</p></div>
            </div>
            <div className="d-flex flex-column gap-3">
              {sessions.length === 0 ? (
                <div className="text-center p-5 text-muted">No practices yet. Go start one! 🎤</div>
              ) : (
                sessions.map((session) => (
                  <PracticeItem 
                    key={session._id} 
                    title={session.speechType || "Free Practice"} 
                    date={new Date(session.date).toLocaleDateString()} 
                    score={session.overallScore} 
                    feedback={`Duration: ${session.duration}`} 
                    onClick={() => handleAnalysisClick(session)} 
                  />
                ))
              )}
            </div>
          </Col>
          <Col lg={4}>
            <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '20px' }}>
              <Card.Body className="p-4">
                <h5 style={{ fontWeight: '800', marginBottom: '25px', color: '#333' }}>Average Performance</h5>
                <SkillBar label="Eye Contact" percentage={skills.eyeContact} color="info" icon="👁️" />
                <SkillBar label="Hand Gestures" percentage={skills.hands} color="warning" icon="👐" />
                <SkillBar label="Posture & Confidence" percentage={skills.posture} color="success" icon="💪" />
                <SkillBar label="Voice & Clarity" percentage={skills.volume} color="primary" icon="🗣️" />
                <hr className="my-4" />
                <div className="p-3 bg-light rounded" style={{ borderLeft: '4px solid #ffc107' }}>
                  <h6 className="fw-bold mb-1">💡 Smart Tip</h6>
                  <small className="text-muted">{smartTip}</small>
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