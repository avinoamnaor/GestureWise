import React from 'react';
import { ProgressBar } from 'react-bootstrap';

const FloatingVolume = ({ volumeLevel }) => {
    return (
        <div className="position-absolute bottom-0 end-0 m-3 px-3 py-2 shadow-sm" 
             style={{ 
                 zIndex: 20, 
                 backgroundColor: 'rgba(255, 255, 255, 0.75)', 
                 backdropFilter: 'blur(5px)', 
                 borderRadius: '20px', 
                 display: 'flex', 
                 alignItems: 'center', 
                 gap: '10px',
                 minWidth: '140px', 
                 maxWidth: '180px',
                 border: '1px solid rgba(255,255,255,0.4)',
                 transition: 'all 0.3s ease'
             }}>
            
            <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                {volumeLevel < 5 ? '🔇' : '🎙️'}
            </span>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div className="d-flex justify-content-between align-items-center">
                    <small className="fw-bold text-secondary" style={{ fontSize: '0.55rem', letterSpacing: '0.5px' }}>
                        {volumeLevel < 10 ? "LOW" : "ACTIVE"}
                    </small>
                    <small className="fw-bold text-dark" style={{ fontSize: '0.6rem' }}>{volumeLevel}%</small>
                </div>
                <ProgressBar 
                    now={volumeLevel} 
                    variant={volumeLevel > 75 ? "danger" : (volumeLevel < 10 ? "warning" : "success")} 
                    style={{ height: '4px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.1)' }} 
                />
            </div>
        </div>
    );
};

export default FloatingVolume;