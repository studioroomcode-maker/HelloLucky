/**
 * Web stand-in for expo-sensors (metro.config.js aliases it on web only). Its web Gyroscope has no addListener
 * (scan.tsx crashed) and reports acceleration, not rotation rate, so on web the boxes simply don't ride the gyro
 * between detector frames.
 */
export const Gyroscope = {
  setUpdateInterval(_ms: number) {},
  addListener(_listener: (rate: { x: number; y: number; z: number }) => void) {
    return { remove() {} };
  },
};
