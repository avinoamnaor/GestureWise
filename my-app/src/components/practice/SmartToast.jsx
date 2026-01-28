import React from 'react';

const SmartToast = ({ message, type, position = 'top' }) => {
    if (!message) return null;
    
    const colors = { warning: '#ffc107', danger: '#dc3545', success: '#198754' };
    
    // קביעת המחלקות (Classes) לפי המיקום המבוקש
    // אם למטה: נצמיד לתחתית (bottom-0) וניתן מרווח מלמטה (mb-5)
    // אם למעלה: נצמיד לראש (top-0) וניתן מרווח מלמעלה (mt-4)
    const positionClasses = position === 'bottom' 
        ? "bottom-0 mb-2" 
        : "top-0 mt-4";

    return (
        <div className={`position-absolute start-50 translate-middle-x p-3 shadow-lg ${positionClasses}`}
             style={{ 
                 zIndex: 100, 
                 backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                 borderRadius: '50px', 
                 borderLeft: `5px solid ${colors[type] || '#fff'}`, 
                 backdropFilter: 'blur(5px)', 
                 animation: 'fadeIn 0.3s ease-in-out' 
             }}>
            <h4 className="text-white m-0 fw-bold px-3">
                {message}
            </h4>
        </div>
    );
};

export default SmartToast;