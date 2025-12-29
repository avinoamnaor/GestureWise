import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();

  // אם אין משתמש מחובר -> זרוק אותו לדף ההתחברות
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // אחרת -> תציג את הדף המבוקש
  return children;
};

export default PrivateRoute;