/**
 * Web (Toss bundle) live detector: the same center-square crop → 960 input → decode as the native frame processor,
 * fed from the <video> of src/web/visionCamera.tsx instead of a VisionCamera worklet. Frames stay in the browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { DETECTOR } from '../../config/detector';
import type { CloverDetectionBox } from '../detectionTracker';
import { modelBoxToUpright } from './frameMapping';
import { loadDetector, type WebDetector } from './model.web';
import { toModelInput } from './tiles';
import { decodeYolo } from './yoloDecode';

export type ModelState = 'loading' | 'ready' | 'error';

export type FrameDetections = {
  boxes: CloverDetectionBox[];
  imageWidth: number;
  imageHeight: number;
};

/** Called by the web Camera for each frame it hands over (one at a time, at most DETECTOR.targetFps). */
export type WebFrameProcessor = (video: HTMLVideoElement) => Promise<void>;

export function useCloverFrameProcessor(onDetections: (result: FrameDetections) => void) {
  const [model, setModel] = useState<WebDetector>();
  const [state, setState] = useState<ModelState>('loading');
  // Same `.value` shape as the native shared value scan.tsx sets.
  const paused = useRef({ value: false }).current;
  const canvas = useRef<HTMLCanvasElement>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadDetector()
      .then((loaded) => {
        if (cancelled) return;
        setModel(loaded);
        setState('ready');
      })
      .catch((error) => {
        console.warn('detector: model failed to load', error);
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const frameProcessor = useCallback<WebFrameProcessor>(
    async (video) => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!model || paused.value || !width || !height) return;
      const size = DETECTOR.inputSize;
      canvas.current ??= Object.assign(document.createElement('canvas'), { width: size, height: size });
      const ctx = canvas.current.getContext('2d', { willReadFrequently: true })!;
      // Center square, like vision-camera-resize-plugin's crop. Browser video frames are already upright.
      const side = Math.min(width, height);
      ctx.drawImage(video, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      const input = toModelInput({ buffer: data.buffer as ArrayBuffer, width: size, height: size, pixelFormat: 'RGBA' }, size);
      const [output] = await model.run([input.buffer as ArrayBuffer]);
      if (paused.value) return;
      const boxes = decodeYolo(new Float32Array(output), DETECTOR.decode).map((box) =>
        modelBoxToUpright(box, width, height, 0, size),
      );
      onDetections({ boxes, imageWidth: width, imageHeight: height });
    },
    [model, onDetections, paused],
  );

  return {
    frameProcessor,
    modelState: state,
    paused,
  };
}
