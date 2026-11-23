import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro bundles .tflite assets via require
const MODEL = require('../../../assets/model/clover.tflite');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro bundles .tflite assets via require
const VERIFIER = require('../../../assets/model/clover_verifier.tflite');

let sharedDetector: Promise<TensorflowModel> | undefined;
let sharedVerifier: Promise<TensorflowModel> | undefined;

/** One detector instance for the live scanner and the wide scan (the model is ~10 MB in memory). */
export function loadDetector(): Promise<TensorflowModel> {
  sharedDetector ??= loadAsset(MODEL, 'detector').catch((error) => {
    sharedDetector = undefined; // let the next screen try again
    throw error;
  });
  return sharedDetector;
}

/** Stage-2 crop classifier (~3 MB): runs on CPU (XNNPACK, ~4 ms) so it never contends with the detector's GPU delegate. */
export function loadVerifier(): Promise<TensorflowModel> {
  sharedVerifier ??= loadAsset(VERIFIER, 'verifier', false).catch((error) => {
    sharedVerifier = undefined;
    throw error;
  });
  return sharedVerifier;
}

async function loadAsset(assetModule: number, label: string, useHardwareDelegate = true): Promise<TensorflowModel> {
  // fast-tflite can't read Android release raw resources itself; expo-asset copies it to a file:// URI.
  const [asset] = await Asset.loadAsync(assetModule);
  if (!asset.localUri) throw new Error(`${label}: model asset has no local file`);
  const source = { url: asset.localUri };
  if (!useHardwareDelegate) {
    return loadTensorflowModel(source, []);
  }
  const accelerated = Platform.OS === 'ios' ? 'core-ml' : 'android-gpu';
  try {
    return await loadTensorflowModel(source, [accelerated]);
  } catch (error) {
    // GPU/CoreML delegates are unavailable on some devices; CPU always works.
    console.warn(`${label}: ${accelerated} delegate failed, using CPU`, error);
    return loadTensorflowModel(source, []);
  }
}
