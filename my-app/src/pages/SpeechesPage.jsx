import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Modal, Form, Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { speeches as staticSpeeches } from '../data/speeches'; // מאגר הנאומים הקבוע

function SpeechesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // נתונים
  const [allSpeeches, setAllSpeeches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // סינון וחיפוש
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'official', 'mine', 'community'
  const [searchTerm, setSearchTerm] = useState("");

  // מודל הוספת נאום
  const [showModal, setShowModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customText, setCustomText] = useState("");
  
  // אפשרויות שמירה
  const [shouldSave, setShouldSave] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. טעינת נתונים (סטטי + דינמי מהשרת)
  useEffect(() => {
    const fetchSpeeches = async () => {
      setIsLoading(true);
      let dbSpeeches = [];
      
      try {
        // אם המשתמש מחובר, נשלח את ה-ID שלו כדי לקבל גם פרטיים
        const userIdParam = user ? `?userId=${user.id}` : '';
        // נסה למשוך מהשרת (וודא שהשרת רץ!)
        const response = await fetch(`http://localhost:5000/api/speeches${userIdParam}`);
        if (response.ok) {
          dbSpeeches = await response.json();
        }
      } catch (error) {
        console.log("Working in offline/static mode or server error");
      }

      // סימון הנאומים הסטטיים כדי שנזהה אותם אח"כ
      const formattedStatic = staticSpeeches.map(s => ({
          ...s, 
          isStatic: true, 
          _id: `static_${s.id}`,
          tags: s.tags || []
      }));

      // איחוד הרשימות
      setAllSpeeches([...formattedStatic, ...dbSpeeches]);
      setIsLoading(false);
    };

    fetchSpeeches();
  }, [user]);

  // 2. לוגיקת הסינון לפי הטאב והחיפוש
  const getFilteredSpeeches = () => {
      let filtered = allSpeeches;

      // סינון לפי טאב
      if (activeTab === 'official') {
          filtered = allSpeeches.filter(s => s.isStatic);
      } else if (activeTab === 'mine') {
          // מראה רק נאומים שהמשתמש הנוכחי יצר
          filtered = allSpeeches.filter(s => !s.isStatic && s.userId === user?.id);
      } else if (activeTab === 'community') {
          // מראה נאומים של משתמשים אחרים שהם ציבוריים
          filtered = allSpeeches.filter(s => !s.isStatic && s.userId !== user?.id);
      }

      // סינון לפי טקסט חיפוש
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          filtered = filtered.filter(s => 
              s.title.toLowerCase().includes(lowerTerm) ||
              (s.authorName || s.author || "").toLowerCase().includes(lowerTerm)
          );
      }

      return filtered;
  };

  const displayedSpeeches = getFilteredSpeeches();

  // 3. ניווט לאימון
  const handleSelectSpeech = (speech) => {
    navigate('/practice', { 
        state: { 
            speechText: speech.text, 
            speechTitle: speech.title 
        } 
    });
  };

  // 4. שמירה ויצירת נאום חדש
  const handleStartCustomPractice = async () => {
      if (!customText.trim()) return alert("Please enter text!");
      
      const finalTitle = customTitle || "My Custom Speech";

      if (shouldSave && user) {
          setIsSaving(true);
          try {
            await fetch('http://localhost:5000/api/speeches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    authorName: user.fullName || user.name || "Community Member",
                    title: finalTitle,
                    text: customText,
                    isPublic: isPublic
                })
            });
            // רענון אוטומטי לא קריטי כאן כי אנחנו עוברים עמוד, אבל לפעם הבאה זה יישמר
          } catch (error) {
              console.error("Failed to save:", error);
          }
          setIsSaving(false);
      }

      // סגירת המודל ומעבר לאימון
      setShowModal(false);
      navigate('/practice', { 
          state: { 
              speechText: customText, 
              speechTitle: finalTitle 
          } 
      });
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
      
      {/* --- Header & Actions --- */}
      <div className="bg-white py-4 border-bottom shadow-sm">
        <Container>
          <Row className="align-items-center g-3">
            <Col md={5}>
              <h2 style={{ fontWeight: '800', color: '#2c3e50', marginBottom: '5px' }}>Library 📚</h2>
              <p className="text-muted mb-0">Practice famous speeches or create your own.</p>
            </Col>
            
            <Col md={7} className="d-flex flex-wrap gap-2 justify-content-md-end align-items-center">
               {/* כפתור הוספה */}
               <Button 
                variant="primary" 
                className="shadow-sm d-flex align-items-center gap-2 rounded-pill px-4"
                style={{ fontWeight: '600' }}
                onClick={() => setShowModal(true)}
              >
                <span>+</span> New Speech
              </Button>
              
              {/* חיפוש */}
              <Form.Control 
                type="text" 
                placeholder="Search..." 
                className="rounded-pill border-muted"
                style={{ maxWidth: '220px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Col>
          </Row>

          {/* --- Tabs Navigation --- */}
          <div className="mt-4 d-flex gap-2 overflow-auto pb-1">
              {[
                  { id: 'all', label: 'All Speeches' },
                  { id: 'official', label: '🏛️ Official' },
                  { id: 'mine', label: '👤 My Library' },
                  { id: 'community', label: '🌍 Community' }
              ].map(tab => (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "dark" : "light"}
                    className={`rounded-pill px-3 ${activeTab === tab.id ? "shadow-sm" : "border"}`}
                    style={{ fontWeight: activeTab === tab.id ? '600' : '500' }}
                    onClick={() => setActiveTab(tab.id)}
                  >
                      {tab.label}
                  </Button>
              ))}
          </div>

        </Container>
      </div>

      {/* --- Grid Content --- */}
      <div className="flex-grow-1 py-4">
        <Container>
          {isLoading ? (
             <div className="text-center py-5 text-muted">Loading library...</div>
          ) : displayedSpeeches.length === 0 ? (
             <div className="text-center py-5">
                 <h4 className="text-muted">No speeches found here 🧐</h4>
                 {activeTab === 'mine' && !user && <p>Please log in to see your personal library.</p>}
                 {activeTab === 'mine' && user && <Button variant="link" onClick={() => setShowModal(true)}>Create your first speech!</Button>}
             </div>
          ) : (
             <Row className="g-4">
                {displayedSpeeches.map((speech) => (
                <Col key={speech._id || speech.id} md={6} lg={4}>
                    <Card className="h-100 border-0 shadow-sm hover-card" style={{ borderRadius: '15px', transition: '0.3s' }}>
                    <Card.Body className="p-4 d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                        {/* תגיות זיהוי */}
                        {speech.isStatic ? (
                            <Badge bg="secondary" className="px-3 py-2 rounded-pill">Official</Badge>
                        ) : speech.userId === user?.id ? (
                            <Badge bg="info" text="dark" className="px-3 py-2 rounded-pill">My Speech</Badge>
                        ) : (
                            <Badge bg="success" className="px-3 py-2 rounded-pill">Community</Badge>
                        )}
                        
                        <small className="text-muted ms-2 text-truncate" style={{maxWidth: '120px'}}>
                            {speech.authorName || speech.author}
                        </small>
                        </div>
                        
                        <Card.Title style={{ fontWeight: '700', fontSize: '1.15rem' }}>{speech.title}</Card.Title>
                        
                        {/* תצוגה מקדימה של הטקסט */}
                        <Card.Text className="text-muted flex-grow-1 mt-2" style={{ 
                            fontSize: '0.9rem', 
                            overflow: 'hidden', 
                            display: '-webkit-box', 
                            WebkitLineClamp: 3, 
                            WebkitBoxOrient: 'vertical' 
                        }}>
                        {speech.text}
                        </Card.Text>

                        {/* חיווי סטטוס פרטי/ציבורי (רק לנאומים שלי) */}
                        {!speech.isStatic && speech.userId === user?.id && (
                            <div className="mb-3 d-flex align-items-center gap-2">
                                <span style={{ fontSize: '0.8rem', color: speech.isPublic ? '#198754' : '#6c757d' }}>
                                    {speech.isPublic ? "🌍 Public to everyone" : "🔒 Private only me"}
                                </span>
                            </div>
                        )}

                        <Button 
                        variant="outline-dark" 
                        className="w-100 mt-auto rounded-pill fw-bold"
                        onClick={() => handleSelectSpeech(speech)}
                        >
                        Practice This 🎤
                        </Button>
                    </Card.Body>
                    </Card>
                </Col>
                ))}
            </Row>
          )}
           <div className="pb-4"></div>
        </Container>
      </div>

      {/* --- Add New Speech Modal --- */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title style={{ fontWeight: '800' }}>Create New Speech 📝</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form>
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">Title</Form.Label>
                    <Form.Control 
                        type="text" 
                        placeholder="e.g., Project Demo, Wedding Toast..." 
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="rounded-pill px-3"
                    />
                </Form.Group>
                <Form.Group className="mb-4">
                    <Form.Label className="fw-bold">Script</Form.Label>
                    <Form.Control 
                        as="textarea" 
                        rows={8} 
                        placeholder="Paste your text here..." 
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        style={{ borderRadius: '15px' }}
                    />
                </Form.Group>

                {/* הגדרות שמירה - רק למחוברים */}
                {user ? (
                    <div className="bg-light p-3 rounded-3 border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="fw-bold m-0" htmlFor="save-switch">Save to Library?</label>
                            <Form.Check 
                                type="switch"
                                id="save-switch"
                                checked={shouldSave}
                                onChange={(e) => setShouldSave(e.target.checked)}
                            />
                        </div>
                        
                        {shouldSave && (
                            <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                                <div>
                                    <label className="fw-bold m-0 d-block" htmlFor="public-switch">Make Public?</label>
                                    <small className="text-muted">Other users will be able to see and practice this speech.</small>
                                </div>
                                <Form.Check 
                                    type="switch"
                                    id="public-switch"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="alert alert-warning py-2 small rounded-3">
                        <i className="bi bi-info-circle me-2"></i>
                        Log in to save your speeches for future practice!
                    </div>
                )}
            </Form>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="link" className="text-muted text-decoration-none" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            className="rounded-pill px-4 fw-bold"
            onClick={handleStartCustomPractice} 
            disabled={!customText.trim() || isSaving}
          >
            {isSaving ? "Saving..." : shouldSave ? "Save & Start 🚀" : "Start Practice 🚀"}
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
}

export default SpeechesPage;