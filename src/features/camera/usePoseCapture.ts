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
const LIVE_UPDATE_INTERVAL_MS = 120;
const VISIBILITY_THRESHOLD = 0.35;

const SKELETON_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [27, 31], [28, 32],
  [0, 11], [0, 12],
];

const LABELLED_POINTS: Array<{ index: number; label: string }> = [
  { index: 0, label: 'head' },
  { index: 15, label: 'left hand' },
  { index: 16, label: 'right hand' },
  { index: 23, label: 'left hip' },
  { index: 24, label: 'right hip' },
  { index: 25, label: 'left knee' },
  { index: 26, label: 'right knee' },
  { index: 27, label: 'left foot' },
  { index: 28, label: 'right foot' },
];

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

function isVisible(point?: LandmarkPoint) {
  return (point?.visibility ?? 0) >= VISIBILITY_THRESHOLD;
}

function drawTorso(context: CanvasRenderingContext2D, landmarks: LandmarkPoint[]) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const rightHip = landmarks[24];
  const leftHip = landmarks[23];

  if (![leftShoulder, rightShoulder, rightHip, leftHip].every(isVisible)) {
    return;
  }

  context.save();
  context.beginPath();
  context.moveTo(leftShoulder.x, leftShoulder.y);
  context.lineTo(rightShoulder.x, rightShoulder.y);
  context.lineTo(rightHip.x, rightHip.y);
  context.lineTo(leftHip.x, leftHip.y);
  context.closePath();
  context.fillStyle = 'rgba(37, 99, 235, 0.14)';
  context.fill();
  context.restore();
}

function drawSkeleton(context: CanvasRenderingContext2D, landmarks: LandmarkPoint[], confidence: number) {
  const strokeColor = confidence > 0.62 ? '#22c55e' : '#f59e0b';

  context.save();
  context.lineWidth = 3;
  context.strokeStyle = strokeColor;
  context.fillStyle = strokeColor;

  drawTorso(context, landmarks);

  SKELETON_CONNECTIONS.forEach(([fromIndex, toIndex]) => {
    const from = landmarks[fromIndex];
    const to = landmarks[toIndex];
    if (!isVisible(from) || !isVisible(to)) return;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  });

  landmarks.forEach((landmark) => {
    if (!isVisible(landmark)) return;
    context.beginPath();
    context.arc(landmark.x, landmark.y, 4, 0, Math.PI * 2);
    context.fill();
  });

  context.restore();
}

function drawBoundingBox(context: CanvasRenderingContext2D, landmarks: LandmarkPoint[]) {
  const visibleLandmarks = landmarks.filter((landmark) => isVisible(landmark));
  if (visibleLandmarks.length < 8) {
    return;
  }

  const minX = Math.min(...visibleLandmarks.map((landmark) => landmark.x));
  const maxX = Math.max(...visibleLandmarks.map((landmark) => landmark.x));
  const minY = Math.min(...visibleLandmarks.map((landmark) => landmark.y));
  const maxY = Math.max(...visibleLandmarks.map((landmark) => landmark.y));

  context.save();
  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.setLineDash([8, 6]);
  context.lineWidth = 2;
  context.strokeRect(minX - 8, minY - 8, maxX - minX + 16, maxY - minY + 16);
  context.restore();
}

function drawLabels(context: CanvasRenderingContext2D, landmarks: LandmarkPoint[]) {
  context.save();
  context.font = '12px Inter, Arial, sans-serif';
  context.textBaseline = 'middle';

  LABELLED_POINTS.forEach(({ index, label }) => {
    const point = landmarks[index];
    if (!isVisible(point)) return;

    const textX = point.x + 8;
    const textY = point.y - 10;
    const textWidth = context.measureText(label).width;

    context.fillStyle = 'rgba(17,24,39,0.78)';
    context.fillRect(textX - 4, textY - 8, textWidth + 8, 16);
    context.fillStyle = '#ffffff';
    context.fillText(label, textX, textY);
  });

  context.restore();
}

export function usePoseCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const overlayActiveRef = useRef(false);
  const initializingRef = useRef(false);
  const liveUpdateRef = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState(0);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [liveLandmarks, setLiveLandmarks] = useState<LandmarkPoint[]>([]);
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);

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
        // Autoplay can retry on the next render or user interaction.
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
    setLiveLandmarks([]);
    setFrameSize(null);
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
        const normalizedLandmarks = result.landmarks?.[0] ?? [];
        const confidence = averageConfidence(normalizedLandmarks);
        const landmarks = toCanvasLandmarks(normalizedLandmarks, canvas.width, canvas.height);

        drawBoundingBox(context, landmarks);
        drawSkeleton(context, landmarks, confidence);
        drawLabels(context, landmarks);

        const now = performance.now();
        if (now - liveUpdateRef.current > LIVE_UPDATE_INTERVAL_MS) {
          setLastConfidence(confidence);
          setLiveLandmarks(landmarks);
          setFrameSize({ width: canvas.width, height: canvas.height });
          liveUpdateRef.current = now;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, []);

  const captureFrame = useCallback((view: ViewType, stageId: string) => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker || video.readyState < 2) {
      return false;
    }

    const result = landmarker.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0] ?? [];
    const confidence = averageConfidence(landmarks);
    if (confidence < 0.45) {
      return false;
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

    return true;
  }, []);

  return {
    videoRef,
    canvasRef,
    frames,
    setFrames,
    liveLandmarks,
    frameSize,
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
