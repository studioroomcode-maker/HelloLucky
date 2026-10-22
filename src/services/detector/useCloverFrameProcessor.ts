/**
 * On-device four-leaf detector: VisionCamera frame → resize (square center crop,
 * float32 RGB) → TFLite YOLOv8 → decode + NMS → boxes in upright frame pixels.
 * No frame ever leaves the device.
 */
import { useEffect, useMemo, useState } from 'react';
import { runAtTargetFps, useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import { NitroModules } from 'react-native-nitro-modules';
import type { TensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { DETECTOR } from '../../config/detector';
import type { CloverDetectionBox } from '../detectionTracker';
import { modelBoxToUpright, uprightRotation, uprightSize } from './frameMapping';
import { loadDetector } from './model';
import { decodeYolo } from './yoloDecode';

export type ModelState = 'loading' | 'ready' | 'error';

export type FrameDetections = {
  boxes: CloverDetectionBox[];
  imageWidth: number;
  imageHeight: number;
};

export function useCloverFrameProcessor(onDetections: (result: FrameDetections) => void) {
  const { resize } = useResizePlugin();
  const [model, setModel] = useState<TensorflowModel>();
  const [state, setState] = useState<ModelState>('loading');

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

  const boxedModel = useMemo(() => (model ? NitroModules.box(model) : undefined), [model]);
  const deliver = useRunOnJS(onDetections, [onDetections]);
  // The live scanner and the shutter's photo check share one interpreter; it must not run twice at once.
  const paused = useSharedValue(false);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (boxedModel == null || paused.value) return;

      // Sync on purpose: runAsync crashes (SIGSEGV in worklets-core 1.6 on the new architecture).
      runAtTargetFps(DETECTOR.targetFps, () => {
        'worklet';
        const { inputSize, decode } = DETECTOR;
        const resized = resize(frame, {
          scale: { width: inputSize, height: inputSize },
          pixelFormat: 'rgb',
          dataType: 'float32',
        });
        const input = resized.buffer.slice(resized.byteOffset, resized.byteOffset + resized.byteLength) as ArrayBuffer;
        const outputs = boxedModel.unbox().runSync([input]);
        const decoded = decodeYolo(new Float32Array(outputs[0]), decode);

        const rotation = uprightRotation(frame.orientation);
        const size = uprightSize(frame.width, frame.height, rotation);
        const boxes = decoded.map((box) => modelBoxToUpright(box, frame.width, frame.height, rotation, inputSize));
        deliver({ boxes, imageWidth: size.width, imageHeight: size.height });
      });
    },
    [boxedModel, resize, deliver, paused],
  );

  return {
    // Always attached: adding a frame processor later makes the camera rebuild its session (a visible flash).
    // Until the model is ready the worklet just returns.
    frameProcessor,
    modelState: state,
    paused,
  };
}
