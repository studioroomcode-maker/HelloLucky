/**
 * Gyro-driven motion of the live preview, so boxes stay on their clovers between detector frames (~6/s).
 * Turning the phone shifts the scene on screen by about focal × angle; the detector re-anchors every box
 * against the motion at its frame's capture time, so gyro drift never accumulates on screen.
 */

export type MotionSample = { t: number; x: number; y: number };

/** Pixels (dp) per radian of rotation for a preview that fills `viewHeight` with the camera's long-side FOV. */
export function focalLength(viewHeight: number, fovDegrees: number, zoomRatio: number) {
  const half = ((fovDegrees || 70) * Math.PI) / 360;
  return (viewHeight / 2 / Math.tan(half)) * Math.max(1, zoomRatio);
}

/** Accumulated motion at time `t` (the latest sample at or before it). */
export function motionAt(history: readonly MotionSample[], t: number): { x: number; y: number } {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].t <= t) return { x: history[i].x, y: history[i].y };
  }
  return history.length ? { x: history[0].x, y: history[0].y } : { x: 0, y: 0 };
}

/**
 * One gyro reading (rad/s, device axes: x right, y up, z out of the screen) → the scene's on-screen shift in a
 * portrait preview from the back camera: yawing left (+y) moves the scene right, pitching up (+x) moves it down.
 */
export function integrate(prev: MotionSample, rate: { x: number; y: number }, t: number, focal: number): MotionSample {
  const dt = Math.min(0.05, Math.max(0, (t - prev.t) / 1000)); // ignore gaps (backgrounding)
  return { t, x: prev.x + focal * rate.y * dt, y: prev.y + focal * rate.x * dt };
}
