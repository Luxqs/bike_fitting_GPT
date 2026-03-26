import { useCallback, useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { CapturedFrame, ViewType } from '../../types';

export function usePoseCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState(0);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);

  const init = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Camera initialization failed');
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  const startOverlayLoop = useCallback(() => {
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const landmarker = landmarkerRef.current;
      if (video && canvas && ctx && landmarker && video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result.landmarks?.[0] ?? [];
        const confidence = landmarks.length ? landmarks.reduce((sum, lm) => sum + (lm.visibility ?? 0.5), 0) / landmarks.length : 0;
        setLastConfidence(confidence);
        ctx.lineWidth = 2;
        landmarks.forEach((lm) => {
          ctx.beginPath();
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, Math.PI * 2);
          ctx.strokeStyle = confidence > 0.6 ? '#22c55e' : '#f59e0b';
          ctx.stroke();
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const captureFrame = useCallback((view: ViewType, stageId: string) => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;
    const result = landmarker.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0] ?? [];
    const confidence = landmarks.length ? landmarks.reduce((sum, lm) => sum + (lm.visibility ?? 0.5), 0) / landmarks.length : 0;
    if (confidence < 0.45) return;
    setFrames((prev) => [
      ...prev,
      {
        timestamp: Date.now(),
        view,
        stageId,
        landmarks: landmarks.map((lm) => ({ x: lm.x * video.videoWidth, y: lm.y * video.videoHeight, z: lm.z, visibility: lm.visibility, presence: lm.presence })),
        confidence,
      },
    ]);
  }, []);

  return { videoRef, canvasRef, frames, setFrames, isReady, error, init, stop, startOverlayLoop, captureFrame, lastConfidence };
}
