import { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { CapturedFrame, LandmarkPoint, ViewType } from '../../types';

interface PoseResultLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
const VISION_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

function toCanvasLandmarks(landmarks: PoseResultLandmark[], width: number, height: number): LandmarkPoint[] {
  return landmarks.map((landmark) => ({
    x: landmark.x * width,
    y: landmark.y * height,
    z: landmark.z,
    visibility: landmark.visibility,
    presence: landmark.presence,
  }));
}

function averageConfidence(landmarks: PoseResultLandmark[]): number {
  if (!landmarks.length) {
    return 0;
  }

  return landmarks.reduce((sum, landmark) => sum + (landmark.visibility ?? 0.5), 0) / landmarks.length;
}

export function usePoseCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const overlayActiveRef = useRef(false);
  const initializingRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState(0);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);

  const attachStreamToCurrentVideo = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;

    if (!video || !stream) {
      return;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    if (video.paused || video.readyState < 2) {
      try {
        await video.play();
      } catch {
        // The user already granted camera access. If autoplay is delayed, the next render or interaction can retry.
      }
    }
  }, []);

  const stopOverlayLoop = useCallback(() => {
    overlayActiveRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stopOverlayLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, [stopOverlayLoop]);

  const init = useCallback(async () => {
    if (initializingRef.current || isReady) {
      return;
    }

    try {
      initializingRef.current = true;
      setIsInitializing(true);
      setError(null);

      const vision = await FilesetResolver.forVisionTasks(VISION_WASM_PATH);
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;

      await attachStreamToCurrentVideo();
      setIsReady(true);
    } catch (initError) {
      const message = initError instanceof Error ? initError.message : 'Camera initialization failed';
      setError(message);
      stop();
      throw initError;
    } finally {
      initializingRef.current = false;
      setIsInitializing(false);
    }
  }, [attachStreamToCurrentVideo, isReady, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    void attachStreamToCurrentVideo();
  });

  const startOverlayLoop = useCallback(() => {
    if (overlayActiveRef.current) {
      return;
    }

    overlayActiveRef.current = true;

    const tick = () => {
      if (!overlayActiveRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      const landmarker = landmarkerRef.current;

      if (video && canvas && context && landmarker && video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result.landmarks?.[0] ?? [];
        const confidence = averageConfidence(landmarks);
        setLastConfidence(confidence);

        context.lineWidth = 2;
        landmarks.forEach((landmark) => {
          context.beginPath();
          context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, Math.PI * 2);
          context.strokeStyle = confidence > 0.6 ? '#22c55e' : '#f59e0b';
          context.stroke();
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, []);

  const captureFrame = useCallback((view: ViewType, stageId: string) => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker || video.readyState < 2) {
      return;
    }

    const result = landmarker.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0] ?? [];
    const confidence = averageConfidence(landmarks);
    if (confidence < 0.45) {
      return;
    }

    setFrames((previousFrames) => [
      ...previousFrames,
      {
        timestamp: Date.now(),
        view,
        stageId,
        landmarks: toCanvasLandmarks(landmarks, video.videoWidth, video.videoHeight),
        confidence,
      },
    ]);
  }, []);

  return {
    videoRef,
    canvasRef,
    frames,
    setFrames,
    isReady,
    isInitializing,
    error,
    init,
    stop,
    startOverlayLoop,
    stopOverlayLoop,
    captureFrame,
    lastConfidence,
  };
}
