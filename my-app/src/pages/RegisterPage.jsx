import React, { useState, useEffect } from 'react'; // הוספת useEffect
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // 1. ייבוא useAuth

function RegisterPage() {
  const navigate = useNavigate();
  const { user } = useAuth(); // 2. שליפת המשתמש
  const [error, setError] = useState("");

  // 3. הגנה: אם מחובר, עוף לפרופיל
  useEffect(() => {
    if (user) {
      navigate('/profile');
    }
  }, [user, navigate]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    const fullName = e.target.formName.value;
    const email = e.target.formBasicEmail.value;
    const password = e.target.formBasicPassword.value;

    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Registration successful! You can now log in.");
        navigate('/login');
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      console.error(err);
      setError("Server error. Please try again later.");
    }
  };

  // שאר ה-return נשאר אותו דבר (בדיוק כמו בקובץ המקורי שלך)
  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: '#FFF5F0' }}>
      <Container style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <Row className="justify-content-center w-100">
          <Col md={6} lg={5}>
            <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', overflow: 'hidden' }}>
              <Card.Body className="p-5">
                
                <div className="text-center mb-4">
                  <h2 style={{ fontWeight: '800', color: '#333' }}>Create Account</h2>
                  <p className="text-muted">Join GestureWise to improve your speaking.</p>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}

                <Form onSubmit={handleRegister}>
                  <Form.Group className="mb-3" controlId="formName">
                    <Form.Label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Full Name</Form.Label>
                    <Form.Control type="text" placeholder="John Doe" required style={{ borderRadius: '10px', padding: '12px' }} />
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="formBasicEmail">
                    <Form.Label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Email Address</Form.Label>
                    <Form.Control type="email" placeholder="Enter email" required style={{ borderRadius: '10px', padding: '12px' }} />
                  </Form.Group>

                  <Form.Group className="mb-4" controlId="formBasicPassword">
                    <Form.Label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Password</Form.Label>
                    <Form.Control type="password" placeholder="Create a password" required style={{ borderRadius: '10px', padding: '12px' }} />
                  </Form.Group>

                  <Button 
                    variant="dark" 
                    type="submit" 
                    className="w-100 py-3 mb-3 shadow-sm" 
                    style={{ borderRadius: '50px', fontWeight: '600' }}
                  >
                    Sign Up
                  </Button>

                  <div className="text-center">
                    <span className="text-muted">Already have an account? </span>
                    <Link to="/login" style={{ fontWeight: '600', color: '#333', textDecoration: 'none' }}>
                      Log in
                    </Link>
                  </div>
                </Form>

              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default RegisterPage;