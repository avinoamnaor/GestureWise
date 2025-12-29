import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
// 1. הוספנו את הייבוא הזה כדי לחבר את הניווט לראוטר
import { Link } from 'react-router-dom';

function CustomNavbar() {
  const brandStyle = {
    fontSize: '1.5rem', 
    fontWeight: 'bold', 
    color: '#000',
    letterSpacing: '1px'
  };

  return (
    <Navbar bg="white" expand="lg" className="py-3 shadow-sm w-100 px-4">
      <Container fluid> 
        {/* תיקון לוגו: לחיצה עליו תחזיר לדף הבית */}
        <Navbar.Brand as={Link} to="/" style={brandStyle}>
          GestureWise
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          
          <Nav className="ms-4"> 
            {/* תיקון הלינקים: שימוש ב-as={Link} ו-to במקום href */}
            <Nav.Link as={Link} to="/" className="mx-2 nav-link-custom">Home</Nav.Link>
            
            {/* לינקים שעוד אין להם עמוד, נשאיר אותם כרגע מובילים לדף הבית או לעמודים עתידיים */}
            <Nav.Link as={Link} to="/profile" className="mx-2 nav-link-custom">Profile</Nav.Link>
            <Nav.Link as={Link} to="/speeches" className="mx-2 nav-link-custom">Speeches</Nav.Link>
            <Nav.Link as={Link} to="/login" className="mx-2 nav-link-custom text-danger">Logout</Nav.Link>
            
          </Nav>
          
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CustomNavbar;