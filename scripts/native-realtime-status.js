function hasModule(moduleName) {
  try {
    require.resolve(moduleName, { paths: [process.cwd()] });
    return true;
  } catch {
    return false;
  }
}

function statusLabel(installed) {
  return installed ? 'installed' : 'missing';
}

const fs = require('fs');
const path = require('path');

const modules = {
  expoCamera: hasModule('expo-camera'),
  visionCamera: hasModule('react-native-vision-camera'),
  worklets: hasModule('react-native-worklets'),
  workletsCore: hasModule('react-native-worklets-core'),
  fastTflite: hasModule('react-native-fast-tflite'),
  nitroModules: hasModule('react-native-nitro-modules'),
  resizePlugin: hasModule('vision-camera-resize-plugin'),
};

const modelPath = path.join(process.cwd(), 'assets', 'model', 'clover.tflite');
const modelPresent = fs.existsSync(modelPath);

console.log('Hello Lucky native realtime status');
console.log('');
console.log('-- snapshot engine deps --');
console.log(`expo-camera: ${statusLabel(modules.expoCamera)}`);
console.log(`react-native-vision-camera: ${statusLabel(modules.visionCamera)}`);
console.log(`react-native-worklets: ${statusLabel(modules.worklets)}`);
console.log(`react-native-worklets-core: ${statusLabel(modules.workletsCore)}`);
console.log('');
console.log('-- on-device engine deps --');
console.log(`react-native-fast-tflite: ${statusLabel(modules.fastTflite)}`);
console.log(`react-native-nitro-modules: ${statusLabel(modules.nitroModules)}`);
console.log(`vision-camera-resize-plugin: ${statusLabel(modules.resizePlugin)}`);
console.log(`assets/model/clover.tflite: ${modelPresent ? 'present' : 'missing'}`);
console.log('');

const onDeviceReady =
  modules.fastTflite && modules.nitroModules && modules.resizePlugin;

if (!modules.visionCamera || !modules.workletsCore) {
  console.log('Snapshot engine deps are incomplete.');
  console.log('Next steps:');
  console.log(
    '1. npx expo install react-native-vision-camera react-native-worklets-core',
  );
  console.log('2. npx expo prebuild');
  console.log('3. npm run start:dev');
} else if (!onDeviceReady) {
  console.log('Snapshot engine is ready. On-device engine deps are missing.');
  console.log('To prepare on-device detection:');
  console.log(
    '1. npm install react-native-fast-tflite react-native-nitro-modules vision-camera-resize-plugin',
  );
  console.log('2. see docs/on-device-detector.md');
} else if (!modelPresent) {
  console.log('All deps present. Missing only the trained model.');
  console.log('Next steps:');
  console.log('1. train a model with training/train_yolo.ipynb');
  console.log('2. drop best_float32.tflite as assets/model/clover.tflite');
  console.log('3. follow docs/on-device-detector.md to wire it in');
  console.log('4. npx expo prebuild && npm run start:dev');
} else {
  console.log('On-device engine is fully provisioned.');
  console.log('Next steps:');
  console.log('1. set EXPO_PUBLIC_ONDEVICE_MODEL_URI and EXPO_PUBLIC_LIVE_VISION_ENGINE=native-realtime');
  console.log('2. wire useCloverFrameProcessor into CameraScreen (docs/on-device-detector.md)');
  console.log('3. npx expo prebuild && npm run start:dev');
}
