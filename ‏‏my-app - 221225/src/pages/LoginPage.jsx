import React from 'react';
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    // 1. המיכל החיצוני: תופס את כל הגובה ומאפשר גלילה
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: '#FFF5F0' }}>
      
      {/* 2. הקונטיינר הפנימי: מינימום גובה 100% כדי לאפשר מירכוז, עם ריפוד (padding) כדי שהכרטיס לא יידבק לקצוות */}
      <Container style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <Row className="justify-content-center w-100">
          <Col md={6} lg={5}>
            <Card className="border-0 shadow-lg" style={{ borderRadius: '20px', overflow: 'hidden' }}>
              <Card.Body className="p-5">
                
                <div className="text-center mb-4">
                  <h2 style={{ fontWeight: '800', color: '#333' }}>Welcome Back</h2>
                  <p className="text-muted">Please enter your details to sign in.</p>
                </div>

                <Form onSubmit={handleLogin}>
                  <Form.Group className="mb-3" controlId="formBasicEmail">
                    <Form.Label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Email Address</Form.Label>
                    <Form.Control 
                      type="email" 
                      placeholder="Enter email" 
                      style={{ borderRadius: '10px', padding: '12px' }}
                    />
                  </Form.Group>

                  <Form.Group className="mb-4" controlId="formBasicPassword">
                    <Form.Label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Password</Form.Label>
                    <Form.Control 
                      type="password" 
                      placeholder="Password" 
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