// Expo 기본 Metro 설정 + 커스텀 asset 확장자.
// react-native-fast-tflite 로 .tflite 모델을 require/번들하려면
// assetExts 에 'tflite' 를 추가해야 합니다.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('tflite')) {
  config.resolver.assetExts.push('tflite');
}

// 웹(앱인토스 번들, TOSS.md) 전용: 네이티브 모듈을 브라우저 구현으로 바꿔 끼운다. iOS·Android 번들은 그대로다.
const WEB_SHIMS = {
  'react-native-vision-camera': 'src/web/visionCamera.tsx',
  'react-native-maps': 'src/web/maps.tsx',
  'react-native-nitro-image': 'src/web/nitroImage.ts',
  'expo-file-system/legacy': 'src/web/fileSystem.ts',
  'react-native-share': 'src/web/share.ts',
  'expo-sensors': 'src/web/sensors.ts',
};
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { type: 'sourceFile', filePath: require('path').join(__dirname, WEB_SHIMS[moduleName]) };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
