/**
 * Web stand-in for react-native-vision-camera (metro.config.js aliases it on web only): getUserMedia into a <video>,
 * frames handed to useCloverFrameProcessor.web.ts, photos grabbed from the stream. Just what app/scan.tsx uses.
 * shortcut: no zoom, torch or tap-to-focus (WebView support varies); add via MediaStreamTrack constraints if asked.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { DETECTOR } from '@/src/config/detector';
import type { WebFrameProcessor } from '@/src/services/detector/useCloverFrameProcessor.web';

export type Orientation = 'portrait' | 'portrait-upside-down' | 'landscape-left' | 'landscape-right';

type CameraError = { code: string; message: string };

type Props = {
  style?: StyleProp<ViewStyle>;
  isActive: boolean;
  frameProcessor?: WebFrameProcessor;
  onError?: (error: CameraError) => void;
  resizeMode?: 'cover' | 'contain';
};

export type Camera = {
  takePhoto(options?: unknown): Promise<{ path: string; width: number; height: number }>;
  focus(point: { x: number; y: number }): Promise<void>;
};

// 4:3 like the native scanner (frames, preview and photo share it).
const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 }, aspectRatio: { ideal: 4 / 3 } },
};

const hasMedia = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export const Camera = forwardRef<Camera, Props>(function Camera({ style, isActive, frameProcessor, onError, resizeMode }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  // Latest callbacks without restarting the stream (scan.tsx passes a fresh onError each render).
  const processor = useRef(frameProcessor);
  processor.current = frameProcessor;
  const errored = useRef(onError);
  errored.current = onError;

  useImperativeHandle(ref, () => ({
    async takePhoto() {
      const v = video.current;
      if (!v?.videoWidth) throw new Error('camera: no frame yet');
      const canvas = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
      canvas.getContext('2d')!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('camera: could not encode photo');
      return { path: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
    },
    async focus() {},
  }));

  useEffect(() => {
    if (!isActive) return;
    let stream: MediaStream | undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stopped) return;
      const started = Date.now();
      const v = video.current;
      if (v && v.readyState >= 2 && processor.current) {
        await processor.current(v).catch((error) => console.warn('camera: frame failed', error));
      }
      timer = setTimeout(tick, Math.max(0, 1000 / DETECTOR.targetFps - (Date.now() - started)));
    };
    navigator.mediaDevices
      .getUserMedia(CONSTRAINTS)
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current) return s.getTracks().forEach((t) => t.stop());
        video.current.srcObject = s;
        await video.current.play();
        tick();
      })
      .catch((error: Error) => errored.current?.({ code: `web/${error.name}`, message: error.message }));
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [isActive]);

  return (
    <View style={style}>
      <video
        ref={video}
        muted
        playsInline
        autoPlay
        style={{ width: '100%', height: '100%', objectFit: resizeMode === 'contain' ? 'contain' : 'cover', background: '#000' }}
      />
    </View>
  );
});

const DEVICE = { neutralZoom: 1, minZoom: 1, maxZoom: 1, hasTorch: false, supportsFocus: false };

export function useCameraDevice(_position: 'back' | 'front') {
  return hasMedia() ? DEVICE : undefined;
}

export function useCameraFormat(_device: unknown, _filters: unknown[]) {
  return { fieldOfView: 70 };
}

export function useCameraPermission() {
  const [hasPermission, setHasPermission] = useState(false);
  useEffect(() => {
    // Already granted (a return visit): skip the gate. Not every WebView knows the 'camera' permission name.
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((status) => status.state === 'granted' && setHasPermission(true))
      .catch(() => {});
  }, []);
  const requestPermission = useCallback(async () => {
    if (!hasMedia()) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      setHasPermission(true);
      return true;
    } catch {
      return false;
    }
  }, []);
  return { hasPermission, requestPermission };
}
