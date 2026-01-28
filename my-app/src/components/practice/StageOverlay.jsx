import React from 'react';

const StageOverlay = ({ posture, movement, hands }) => {
    if (posture.includes("Step") || posture.includes("Too")) {
        return (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                 style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 20 }}>
                <div className="text-center">
                    <h1 className="text-white fw-bold display-1">{posture}</h1>
                </div>
            </div>
        );
    }
    let message = null; let colorClass = "warning";
    if (hands.includes("Show") || hands.includes("Uncross") || hands.includes("Low") || hands.includes("Touch")) {
        message = hands; colorClass = "warning";
    } else if (movement.includes("Move") || movement.includes("Stop")) {
        message = movement; colorClass = "info";
    } else if (posture.includes("Straighten") || posture.includes("Look Up")) {
        message = posture; colorClass = "warning";
    }
    if (!message) return null;
    return (
        <div className="position-absolute top-50 start-50 translate-middle text-center p-4" 
             style={{ minWidth: '60%', borderRadius: '20px', zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', border: `3px solid ${colorClass === 'warning' ? '#ffc107' : '#0dcaf0'}` }}>
            <h1 className={`fw-bold display-4 m-0 ${colorClass === 'warning' ? 'text-warning' : 'text-info'}`} style={{ textShadow: '2px 2px 4px #000' }}>{message}</h1>
        </div>
    );
};

export default StageOverlay;