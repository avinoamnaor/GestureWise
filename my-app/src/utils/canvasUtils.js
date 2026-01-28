
export const drawFaceBox = (ctx, faceLandmarks, isTouching) => {
    if (!faceLandmarks) return;
    const xs = faceLandmarks.map(p => p.x); const ys = faceLandmarks.map(p => p.y); 
    const pad = 0.05; 
    const minX = Math.min(...xs) - pad; const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad; const maxY = Math.max(...ys) + pad;
    const width = maxX - minX; const height = maxY - minY;
    ctx.beginPath(); ctx.lineWidth = 3;
    ctx.strokeStyle = isTouching ? "rgba(255, 0, 0, 0.9)" : "rgba(255, 235, 59, 0.5)"; 
    ctx.rect(minX * ctx.canvas.width, minY * ctx.canvas.height, width * ctx.canvas.width, height * ctx.canvas.height);
    ctx.stroke();
};

export const drawHands = (ctx, poseLandmarks, isTouching) => {
    const drawHandConnections = (indices, color) => {
        ctx.strokeStyle = color; ctx.lineWidth = isTouching ? 5 : 3; ctx.beginPath();
        const p0 = poseLandmarks[indices[0]];
        if(p0 && p0.visibility > 0.3) { 
          ctx.moveTo(p0.x * ctx.canvas.width, p0.y * ctx.canvas.height);
          for (let i = 1; i < indices.length; i++) {
              const p = poseLandmarks[indices[i]];
              if (p && p.visibility > 0.3) ctx.lineTo(p.x * ctx.canvas.width, p.y * ctx.canvas.height);
          }
          ctx.stroke(); ctx.fillStyle = color;
          indices.forEach(idx => { if(poseLandmarks[idx]?.visibility > 0.3) { ctx.beginPath(); ctx.arc(poseLandmarks[idx].x * ctx.canvas.width, poseLandmarks[idx].y * ctx.canvas.height, 4, 0, 2 * Math.PI); ctx.fill(); } });
        }
    };
    drawHandConnections([15, 17, 19, 21], isTouching ? "red" : "#00ff00");
    drawHandConnections([16, 18, 20, 22], isTouching ? "red" : "#00ff00");
};