import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro bundles .tflite assets via require
const MODEL = require('../../../assets/model/clover.tflite');

let shared: Promise<TensorflowModel> | undefined;

/** One detector instance for the live scanner and the wide scan (the model is ~10 MB in memory). */
export function loadDetector(): Promise<TensorflowModel> {
  shared ??= load().catch((error) => {
    shared = undefined; // let the next screen try again
    throw error;
  });
  return shared;
}

async function load(): Promise<TensorflowModel> {
  // fast-tflite can't read Android release raw resources itself; expo-asset copies it to a file:// URI.
  const [asset] = await Asset.loadAsync(MODEL);
  if (!asset.localUri) throw new Error('detector: model asset has no local file');
  const source = { url: asset.localUri };
  const accelerated = Platform.OS === 'ios' ? 'core-ml' : 'android-gpu';
  try {
    return await loadTensorflowModel(source, [accelerated]);
  } catch (error) {
    // GPU/CoreML delegates are unavailable on some devices; CPU always works.
    console.warn(`detector: ${accelerated} delegate failed, using CPU`, error);
    return loadTensorflowModel(source, []);
  }
}
