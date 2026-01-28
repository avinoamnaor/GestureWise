import { useState, useRef, useCallback } from 'react';

export const useSessionRecorder = () => {
    // References for the recorder instance and raw video data
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const startTimeRef = useRef(null);
    
    const [isSaving, setIsSaving] = useState(false);

    // --- Start Recording (Safe Mode) ---
    const startRecording = useCallback((stream) => {
        // Reset storage and timer
        recordedChunksRef.current = [];
        startTimeRef.current = Date.now();
        
        // Ensure previous recorder is stopped
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        try {
            // 1. Browser Capability Check: Try to use high-quality VP9, fallback to MP4
            let options = { mimeType: "video/webm" };
            if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
                options = { mimeType: "video/webm;codecs=vp9" };
            } else if (MediaRecorder.isTypeSupported("video/mp4")) {
                options = { mimeType: "video/mp4" };
            }
            
            const recorder = new MediaRecorder(stream, options);

            // 2. Data Handler: Collect video chunks as they arrive
            recorder.ondataavailable = (event) => { 
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data); 
                }
            };

            // 3. CRITICAL: Request data every 1 second (1000ms) 
            // This ensures we have video data saved even if the browser crashes later.
            recorder.start(1000); 
            
            mediaRecorderRef.current = recorder;
            console.log("🎥 Recording started (chunk mode)...");

        } catch (err) {
            console.error("❌ Recording failed to start", err);
        }
    }, []);

    // --- Stop Session & Calculate Scores ---
    const stopSession = useCallback(async (sessionStats, liveScore, user, speechTitle, practiceMode) => {
        setIsSaving(true);
        console.log("🛑 Stopping session...");

        let videoBlob = null;
        
        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                
                // 4. Async Stop with Timeout Protection
                // Browsers sometimes hang on .stop(). This Promise ensures we don't wait forever.
                videoBlob = await new Promise((resolve) => {
                    
                    // Fallback: If browser doesn't stop in 1s, force-create blob from existing chunks
                    const timeoutId = setTimeout(() => {
                        console.warn("⚠️ Stop timeout - forcing blob creation from existing chunks");
                        const fallbackBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
                        resolve(fallbackBlob);
                    }, 1000);

                    // Success: Browser stopped normally
                    mediaRecorderRef.current.onstop = () => {
                        clearTimeout(timeoutId);
                        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
                        console.log("✅ Video finalized normally, size:", blob.size);
                        resolve(blob);
                    };

                    mediaRecorderRef.current.stop();
                });

            } else {
                // Recovery: If recorder was already closed, try to recover data from memory
                if (recordedChunksRef.current.length > 0) {
                    videoBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
                    console.log("ℹ️ Recovered video from chunks buffer");
                }
            }
        } catch (e) {
            console.error("❌ Error during stopSession:", e);
        }

        // --- 5. Metrics Calculation & Normalization ---
        const durationSeconds = (Date.now() - startTimeRef.current) / 1000;
        const formattedDuration = `${Math.floor(durationSeconds / 60)}:${Math.floor(durationSeconds % 60) < 10 ? '0' : ''}${Math.floor(durationSeconds % 60)}`;

        const total = Math.max(1, sessionStats.totalFrames);
        
        // Helper to convert "Bad Frames Count" to "0-100 Score"
        const calcMetric = (badFrames) => Math.max(0, Math.round(100 - (badFrames / total * 100)));

        const speechTimeRatio = sessionStats.goodVolumeFrames / total;
        const volumeScore = Math.min(100, Math.round((speechTimeRatio / 0.15) * 100));

        // Final Report Card
        const scores = {
            eyeContact: calcMetric(sessionStats.eyesBadFrames),
            centering: calcMetric(sessionStats.centerBadFrames),
            hands: calcMetric(sessionStats.handsBadFrames),
            expression: Math.round((sessionStats.smilingFrames / total) * 100),
            volume: volumeScore,
            posture: calcMetric(sessionStats.centerBadFrames), 
            articulation: 100
        };

        const sessionData = {
            userId: user ? user.id : "Guest", 
            speechTitle: speechTitle || "Free Practice",
            practiceMode: practiceMode || 'sitting',
            date: new Date(),
            duration: formattedDuration,
            overallScore: liveScore, 
            metrics: scores,
        };

        setIsSaving(false);
        return { sessionData, videoBlob };
    }, []);

    return { startRecording, stopSession, isSaving };
};