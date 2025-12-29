import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const speechesData = [
  { id: 1, title: "I Have a Dream", author: "Martin Luther King Jr.", difficulty: "Hard", duration: "5 min", tags: ["Historical", "Inspirational"] },
  { id: 2, title: "Steve Jobs Stanford Speech", author: "Steve Jobs", difficulty: "Medium", duration: "3 min", tags: ["Business", "Motivation"] },
  { id: 3, title: "Elevator Pitch", author: "Template", difficulty: "Easy", duration: "1 min", tags: ["Business", "Short"] },
  { id: 4, title: "Wedding Toast", author: "Template", difficulty: "Easy", duration: "2 min", tags: ["Social", "Casual"] },
  { id: 5, title: "We shall fight on the beaches", author: "Winston Churchill", difficulty: "Hard", duration: "4 min", tags: ["Historical", "Powerful"] },
  { id: 6, title: "Custom Text", author: "You", difficulty: "N/A", duration: "Flexible", tags: ["Free Style"] },
  // הוספתי עוד פריטים כדי לוודא שהגלילה מופיעה
  { id: 7, title: "TED Talk Intro", author: "Template", difficulty: "Medium", duration: "3 min", tags: ["Education"] },
  { id: 8, title: "Gettysburg Address", author: "Abraham Lincoln", difficulty: "Hard", duration: "2 min", tags: ["Historical"] },
  { id: 9, title: "Sales Pitch", author: "Template", difficulty: "Easy", duration: "2 min", tags: ["Business"] },
];

function SpeechesPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSpeeches = speechesData.filter(speech => 
    speech.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    speech.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    // השינוי הקריטי כאן:
    // 1. height: '100%' - תופס את כל המקום הזמין
    // 2. overflowY: 'auto' - מאפשר גלילה בתוך העמוד הזה בלבד
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
      
      {/* עיצוב קומפקטי (py-3) כמו שאהבת */}
      <div className="bg-cream py-3 border-bottom">
        <Container>
          <Row className="align-items-center">
            <Col md={6}>
              <h2 style={{ fontWeight: '700', color: '#333', fontSize: '1.8rem', marginBottom: '5px' }}>Speech Library</h2>
              <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>Choose a text to practice or upload your own.</p>
            </Col>
            <Col md={6} className="mt-3 mt-md-0">
              <Form.Control 
                type="text" 
                placeholder="Search speeches..." 
                style={{ borderRadius: '50px', padding: '8px 20px', border: '1px solid #ddd', fontSize: '0.95rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Col>
          </Row>
        </Container>
      </div>

      <div className="flex-grow-1 py-4">
        <Container>
          <Row className="g-3">
            {filteredSpeeches.map((speech) => (
              <Col key={speech.id} md={6} lg={4}>
                <Card className="h-100 shadow-sm border-0 hover-effect" style={{ borderRadius: '15px', transition: 'all 0.3s' }}>
                  <Card.Body className="d-flex flex-column p-3">
                    
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <Badge bg={speech.difficulty === 'Hard' ? 'danger' : speech.difficulty === 'Medium' ? 'warning' : 'success'} 
                             text={speech.difficulty === 'Medium' ? 'dark' : 'white'}
                             style={{ borderRadius: '20px', padding: '4px 10px', fontWeight: '500', fontSize: '0.75rem' }}>
                        {speech.difficulty}
                      </Badge>
                      <small className="text-muted" style={{ fontSize: '0.8rem' }}>{speech.duration}</small>
                    </div>
                    
                    <h5 style={{ fontWeight: '700', marginBottom: '2px', fontSize: '1.1rem' }}>{speech.title}</h5>
                    <p className="text-muted small mb-2">By {speech.author}</p>
                    
                    <div className="mb-3">
                      {speech.tags.map((tag, idx) => (
                        <span key={idx} style={{ fontSize: '0.75rem', backgroundColor: '#f0f0f0', padding: '3px 8px', borderRadius: '8px', marginRight: '5px', color: '#555', display: 'inline-block', marginBottom: '3px' }}>
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto">
                      <Button 
                        variant="outline-dark" 
                        className="w-100" 
                        size="sm"
                        style={{ borderRadius: '50px', fontWeight: '600', padding: '6px 0' }}
                        onClick={() => navigate('/practice')} 
                      >
                        Practice This
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          {/* רווח קטן בסוף כדי שהכרטיסים לא יידבקו לתחתית בגלילה */}
          <div className="pb-4"></div>
        </Container>
      </div>

    </div>
  );
}

export default SpeechesPage;