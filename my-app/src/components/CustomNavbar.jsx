import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function CustomNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Navbar 
      bg="white" 
      expand="lg" 
      className="shadow-sm py-3" 
      sticky="top"
      // 👇 התיקון הקריטי כאן: מעלה את התפריט מעל הוידאו
      style={{ zIndex: 9999, position: 'relative' }} 
    >
      <Container>
        <Navbar.Brand as={Link} to="/" style={{ fontWeight: '800', fontSize: '1.5rem', color: '#2c3e50' }}>
          GestureWise
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/" style={{ fontWeight: '500' }}>Home</Nav.Link>
            <Nav.Link as={Link} to="/practice" style={{ fontWeight: '500' }}>Practice</Nav.Link>
            <Nav.Link as={Link} to="/speeches" style={{ fontWeight: '500' }}>Speeches</Nav.Link>
            
            {/* קישור לפרופיל - מופיע רק למשתמש מחובר */}
            {user && (
              <Nav.Link as={Link} to="/profile" style={{ fontWeight: '500' }}>
                Profile
              </Nav.Link>
            )}
          </Nav>

          <Nav className="align-items-center gap-3">
            {user ? (
              // --- מצב מחובר ---
              <>
                <span className="text-muted d-none d-lg-block" style={{ fontSize: '0.9rem' }}>
                  Hi, {user.fullName || user.name}
                </span>
                <Button 
                  variant="outline-danger" 
                  size="sm" 
                  onClick={handleLogout}
                  style={{ borderRadius: '20px', padding: '5px 15px' }}
                >
                  Logout
                </Button>
              </>
            ) : (
              // --- מצב אורח ---
              <>
                <Nav.Link as={Link} to="/login" style={{ fontWeight: '600' }}>Log In</Nav.Link>
                <Button 
                  as={Link} 
                  to="/register" 
                  variant="dark" 
                  size="sm" 
                  style={{ borderRadius: '20px', padding: '8px 20px' }}
                >
                  Sign Up
                </Button>
              </>
            )}
          </Nav>
          
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CustomNavbar;