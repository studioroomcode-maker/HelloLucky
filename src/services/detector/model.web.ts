/**
 * Web (Toss bundle) detector: the same clover.tflite as the apps, run by LiteRT.js (WebGPU when the WebView has it,
 * else XNNPack on WebAssembly). Same NHWC float32 input and [1, 6, N] output, so yoloDecode/tiles work unchanged.
 * The runtime's .wasm files are served from /litert/ (copied by toss/build-src.mjs, or `npm run toss:wasm` for dev).
 */
import { Asset } from 'expo-asset';
import { loadAndCompile, loadLiteRt, Tensor } from '@litertjs/core';

import { DETECTOR } from '../../config/detector';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro bundles .tflite assets via require
const MODEL = require('../../../assets/model/clover.tflite');

/** The slice of fast-tflite's TensorflowModel that wideScan.ts and useCloverFrameProcessor.web.ts use. */
export type WebDetector = { run(inputs: ArrayBuffer[]): Promise<ArrayBuffer[]> };

let shared: Promise<WebDetector> | undefined;

export function loadDetector(): Promise<WebDetector> {
  shared ??= load().catch((error) => {
    shared = undefined; // let the next screen try again
    throw error;
  });
  return shared;
}

async function load(): Promise<WebDetector> {
  await loadLiteRt('/litert/');
  const url = Asset.fromModule(MODEL).uri;
  const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  let model: Awaited<ReturnType<typeof loadAndCompile>>;
  try {
    model = await loadAndCompile(url, { accelerator: gpu ? 'webgpu' : 'wasm' });
  } catch (error) {
    if (!gpu) throw error;
    console.warn('detector: webgpu failed, using wasm', error);
    model = await loadAndCompile(url, { accelerator: 'wasm' });
  }
  const size = DETECTOR.inputSize;
  // One run at a time: the live loop and the shutter's photo check share this model.
  let queue = Promise.resolve();
  const run = async (inputs: ArrayBuffer[]) => {
    const input = new Tensor(new Float32Array(inputs[0]), [1, size, size, 3]);
    try {
      const outputs = await model.run(input);
      try {
        return [((await outputs[0].data()) as Float32Array).slice().buffer];
      } finally {
        outputs.forEach((t) => t.delete());
      }
    } finally {
      input.delete();
    }
  };
  return {
    run(inputs) {
      const next = queue.then(() => run(inputs));
      queue = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}
