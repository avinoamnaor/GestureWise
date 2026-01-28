import { useState, useEffect, useRef } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export const usePracticeAI = () => {
    const faceLandmarkerRef = useRef(null);
    const poseLandmarkerRef = useRef(null);
    const [isModelsLoaded, setIsModelsLoaded] = useState(false);
    const [aiError, setAiError] = useState(null);

    useEffect(() => {
        const createLandmarkers = async () => {
            try {
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );
                
                faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: { 
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, 
                        delegate: "GPU" 
                    },
                    outputFaceBlendshapes: true, 
                    runningMode: "VIDEO", 
                    numFaces: 1
                });

                poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: { 
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`, 
                        delegate: "GPU" 
                    },
                    runningMode: "VIDEO", 
                    numPoses: 1
                });

                setIsModelsLoaded(true);
            } catch (err) {
                console.error(err);
                setAiError("Failed to load AI models.");
            }
        };
        createLandmarkers();
    }, []);

    return { 
        faceLandmarkerRef, 
        poseLandmarkerRef, 
        isModelsLoaded, 
        aiError 
    };
};