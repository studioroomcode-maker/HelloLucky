// Expo 기본 Metro 설정 + 커스텀 asset 확장자.
// react-native-fast-tflite 로 .tflite 모델을 require/번들하려면
// assetExts 에 'tflite' 를 추가해야 합니다.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('tflite')) {
  config.resolver.assetExts.push('tflite');
}

module.exports = config;
