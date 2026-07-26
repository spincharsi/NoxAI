import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  active: boolean;
  ready: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  capture: () => Promise<File | null>;
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setActive(true);
    setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch {
      setError('Camera access was blocked or is unavailable on this device. Try uploading a photo instead.');
      setActive(false);
    }
  }, []);

  const capture = useCallback(async (): Promise<File | null> => {
    if (!videoRef.current || !streamRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(new File([blob], `prescription-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { videoRef, active, ready, error, start, stop, capture };
}
