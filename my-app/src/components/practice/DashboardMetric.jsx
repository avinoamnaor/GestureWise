import React from 'react';

const DashboardMetric = ({ label, value, subValue }) => {
    const isPositive = (val) => val && (val.includes("Good") || val.includes("Perfect") || val.includes("Centered") || val.includes("Straight") || val.includes("Level") || val.includes("Open") || val.includes("Smiling") || val.includes("Engaged") || val.includes("Balanced") || val.includes("Lighting Good") || val.includes("Great"));
    const isNegative = (val) => val && (val.includes("Too") || val.includes("Don't") || val.includes("Away") || val.includes("Low") || val.includes("High") || val.includes("Uneven") || val.includes("Reading") || val.includes("Tucked") || val.includes("Dark"));
    
    const mainBad = isNegative(value);
    const subBad = subValue ? isNegative(subValue) : false;
    const mainGood = isPositive(value);
    
    const borderColor = (mainBad || subBad) ? '#dc3545' : (mainGood ? '#198754' : '#6c757d');
    const textColor = (mainBad || subBad) ? 'text-danger' : (mainGood ? 'text-success' : 'text-dark');

    return (
        // שימוש ב-p-1 לחיסכון במקום
        <div className="bg-light p-1 mb-1 rounded-3 shadow-sm border-start border-4" style={{ borderColor: borderColor, minHeight: '42px', display: 'flex', alignItems: 'center' }}>
            <div className="flex-grow-1 ps-2" style={{ lineHeight: '1' }}>
                <h6 className="text-muted text-uppercase fw-bold m-0" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>{label}</h6>
                <div className={`fw-bold ${textColor}`} style={{ fontSize: '0.95rem' }}>{value}</div>
                {subValue && <div className={`fw-bold ${isNegative(subValue) ? 'text-danger' : 'text-muted'}`} style={{ fontSize: '0.75rem' }}>{subValue}</div>}
            </div>
        </div>
    );
};

export default DashboardMetric;