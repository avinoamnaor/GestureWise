import React, { createContext, useState, useEffect, useContext } from 'react';

// 1. יצירת ההקשר (המקום שבו המידע יישמר)
const AuthContext = createContext(null);

// 2. הרכיב שעוטף את האפליקציה ומספק את המידע
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // בעת טעינת האתר, נבדוק אם יש כבר משתמש שמור בזיכרון
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
  }, []);

  // פונקציית התחברות
  const login = (userData, newToken) => {
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // פונקציית התנתקות
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // הערכים שיהיו זמינים לכל האתר
  const value = {
    user,
    token,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 3. הוק (Hook) מותאם אישית לשימוש קל
export const useAuth = () => {
  return useContext(AuthContext);
};