import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css'; 
import './index.css'; 

import CustomNavbar from './components/CustomNavbar';
import HomePage from './pages/HomePage';
import SpeechesPage from './pages/SpeechesPage';
import PracticePage from './pages/PracticePage';
import ProfilePage from './pages/ProfilePage';
import SummaryPage from './pages/SummaryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function App() {
  return (
    <Router>
      <CustomNavbar />
      
      <div className="main-content">
        <Routes>
          {/* הנתיב הראשי - דף הבית */}
          <Route path="/" element={<HomePage />} />
          
          {/* 2. הנתיב החדש: כשהכתובת היא /practice, תציג את PracticePage */}
          <Route path="/practice" element={<PracticePage />} />

          <Route path="/speeches" element={<SpeechesPage />} />

          <Route path="/profile" element={<ProfilePage />} />

          <Route path="/summary" element={<SummaryPage />} />

          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;