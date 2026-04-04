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

const modules = {
  expoCamera: hasModule('expo-camera'),
  visionCamera: hasModule('react-native-vision-camera'),
  worklets: hasModule('react-native-worklets'),
  workletsCore: hasModule('react-native-worklets-core'),
};

console.log('Hello Lucky native realtime status');
console.log('');
console.log(`expo-camera: ${statusLabel(modules.expoCamera)}`);
console.log(`react-native-vision-camera: ${statusLabel(modules.visionCamera)}`);
console.log(`react-native-worklets: ${statusLabel(modules.worklets)}`);
console.log(`react-native-worklets-core: ${statusLabel(modules.workletsCore)}`);
console.log('');

if (modules.visionCamera && modules.workletsCore) {
  console.log('VisionCamera dependencies are present.');
  console.log('Next steps:');
  console.log('1. npx expo prebuild');
  console.log('2. npm run start:dev');
  console.log('3. rebuild the native app so frame processors are compiled in');
} else {
  console.log('The camera screen will stay on the older fallback path until VisionCamera is installed.');
  console.log('Next steps:');
  console.log(
    '1. npx expo install react-native-vision-camera react-native-worklets-core',
  );
  console.log('2. npx expo prebuild');
  console.log('3. npm run start:dev');
}
