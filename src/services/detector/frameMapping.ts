import type { Orientation } from 'react-native-vision-camera';

import type { CloverDetectionBox } from '../detectionTracker';

/**
 * Clockwise rotation that makes a frame upright, per VisionCamera's
 * Frame.orientation (Android: reversed CameraX rotationDegrees).
 */
export function uprightRotation(orientation: Orientation): 0 | 90 | 180 | 270 {
  'worklet';
  switch (orientation) {
    case 'landscape-right':
      return 90;
    case 'portrait-upside-down':
      return 180;
    case 'landscape-left':
      return 270;
    default:
      return 0;
  }
}

/**
 * The resize plugin center-crops the raw (unrotated) frame to a square before
 * scaling to the model input. Map a model-space box back to the upright frame.
 */
export function modelBoxToUpright(
  box: CloverDetectionBox,
  frameWidth: number,
  frameHeight: number,
  rotation: 0 | 90 | 180 | 270,
  inputSize: number,
): CloverDetectionBox {
  'worklet';
  const side = Math.min(frameWidth, frameHeight);
  const k = side / inputSize;
  const x = (frameWidth - side) / 2 + box.x * k;
  const y = (frameHeight - side) / 2 + box.y * k;
  const w = box.width * k;
  const h = box.height * k;

  switch (rotation) {
    case 90:
      return { x: frameHeight - y, y: x, width: h, height: w, confidence: box.confidence };
    case 180:
      return { x: frameWidth - x, y: frameHeight - y, width: w, height: h, confidence: box.confidence };
    case 270:
      return { x: y, y: frameWidth - x, width: h, height: w, confidence: box.confidence };
    default:
      return { x, y, width: w, height: h, confidence: box.confidence };
  }
}

export function uprightSize(frameWidth: number, frameHeight: number, rotation: number) {
  'worklet';
  return rotation === 90 || rotation === 270
    ? { width: frameHeight, height: frameWidth }
    : { width: frameWidth, height: frameHeight };
}

/** Project an upright-frame box onto a view showing the frame with resizeMode="cover". */
export function projectToView(
  box: CloverDetectionBox,
  imageWidth: number,
  imageHeight: number,
  viewWidth: number,
  viewHeight: number,
) {
  const scale = Math.max(viewWidth / imageWidth, viewHeight / imageHeight);
  const offsetX = (viewWidth - imageWidth * scale) / 2;
  const offsetY = (viewHeight - imageHeight * scale) / 2;
  return {
    left: offsetX + (box.x - box.width / 2) * scale,
    top: offsetY + (box.y - box.height / 2) * scale,
    width: box.width * scale,
    height: box.height * scale,
  };
}
