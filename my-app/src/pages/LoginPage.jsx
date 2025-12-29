import React, { useState, useEffect } from 'react'; // 1. הוספנו useEffect
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth(); // 2. שולפים גם את ה-user
  const [error, setError] = useState("");

  // 3. הוספנו את הבדיקה הזו:
  useEffect(() => {
    if (user) {
      navigate('/profile'); // אם אתה כבר מחובר, לך לפרופיל
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const email = e.target.formBasicEmail.value;
    const password = e.target.formBasicPassword.value;

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user, data.token); 
        navigate('/profile');
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      console.error(err);
      setError("Server error. Please try again later.");
    }
  };

  // שאר הקוד נשאר זהה...
  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: '#FFF5F0' }}>
      <Container style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <Row className="justify-content-center w-100">
          <Col md={6} lg={5}>
            <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', overflow: 'hidden' }}>
              <Card.Body className="p-5">
                
                <div className="text-center mb-4">
                  <h2 style={{ fontWeight: '800', color: '#333' }}>Welcome Back</h2>
                  <p className="text-muted">Please enter your details to sign in.</p>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}

                <Form onSubmit={handleLogin}>
                  <Form.Group className="mb-3" controlId="formBasicEmail">
                    <Form.Label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Email Address</Form.Label>
                    <Form.Control 
                      type="email" 
                      placeholder="Enter email" 
                      required
                      style={{ borderRadius: '10px', padding: '12px' }}
                    />
                  </Form.Group>

                  <Form.Group className="mb-4" controlId="formBasicPassword">
                    <Form.Label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Password</Form.Label>
                    <Form.Control 
                      type="password" 
                      placeholder="Password" 
                      required
                      style={{ borderRadius: '10px', padding: '12px' }}
                    />
                  </Form.Group>

                  <Button 
                    variant="dark" 
                    type="submit" 
                    className="w-100 py-3 mb-3 shadow-sm" 
                    style={{ borderRadius: '50px', fontWeight: '600' }}
                  >
                    Sign In
                  </Button>

                  <div className="text-center">
                    <span className="text-muted">Don't have an account? </span>
                    <Link to="/register" style={{ fontWeight: '600', color: '#333', textDecoration: 'none' }}>
                      Sign up
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

export default LoginPage;