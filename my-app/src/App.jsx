import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CustomNavbar from './components/CustomNavbar';

// 1. ייבוא המנהל החדש שיצרנו
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
// ייבוא הדפים שלך (ודא שהנתיבים נכונים)
import HomePage from './pages/HomePage';
import PracticePage from './pages/PracticePage';
import SpeechesPage from './pages/SpeechesPage'; // אם קיים
import ProfilePage from './pages/ProfilePage';
import SummaryPage from './pages/SummaryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function App() {
  return (
    // 2. עטיפת כל האפליקציה - מעכשיו לכולם יש גישה למידע על המשתמש
    <AuthProvider>
      <Router>
        <CustomNavbar />
        <div className="main-content">
          <Routes>
            {/* דפים פתוחים לכולם - כולל אימון! */}
            <Route path="/" element={<HomePage />} />
            <Route path="/speeches" element={<SpeechesPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/practice" element={<PracticePage />} /> {/* הוצאנו אותו החוצה */}

            {/* דפים מוגנים (רק למשתמשים רשומים) */}
            <Route 
              path="/profile" 
              element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              } 
            />

            {/* את הסיכום נשאיר פתוח כדי שגם אורח יוכל לראות תוצאות מיד אחרי אימון */}
            <Route path="/summary" element={<SummaryPage />} /> 
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;