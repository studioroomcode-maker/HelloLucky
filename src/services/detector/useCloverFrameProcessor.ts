/**
 * 온디바이스 클로버 감지 프레임 프로세서 훅 (활성화 준비 완료)
 *
 * 이 훅은 스냅샷/네트워크 없이 VisionCamera 프레임을 그 자리에서(worklet)
 * TFLite 모델로 추론합니다. 파이프라인:
 *   frame → resize(inputSize²·rgb·float32) → tflite.runSync → decodeYolo(NMS) → JS 콜백
 *
 * 왜 아직 CameraScreen 에 연결되어 있지 않은가:
 *   1. 학습된 clover.tflite 모델 파일이 있어야 동작합니다 (training/train_yolo.ipynb 산출물).
 *   2. 네이티브 재빌드(prebuild)가 필요합니다.
 *   3. 실기기에서만 검증할 수 있습니다.
 *   연결 방법은 docs/on-device-detector.md 의 활성화 절차를 따르세요.
 *
 * 이 파일은 어디서도 import 되지 않으므로, 현재 동작하는 스냅샷 앱에는
 * 아무 영향이 없습니다 (Metro 는 도달 가능한 파일만 번들).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  runAtTargetFps,
  useFrameProcessor,
  type ReadonlyFrameProcessor,
} from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { NitroModules } from 'react-native-nitro-modules';
import {
  loadTensorflowModel,
  type TensorflowModel,
  type TensorflowModelDelegate,
} from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { ON_DEVICE_MODEL } from '../../config/onDeviceModel';
import type { CloverDetectionBox } from '../cloverDetection';
import { decodeYolo } from './yoloDecode';

export type OnDeviceModelState = 'idle' | 'loading' | 'loaded' | 'error';

type Options = {
  /** 초당 추론 횟수 상한 (프리뷰는 30fps 유지, 추론만 제한). */
  targetFps: number;
  /** 디코딩된 박스를 JS 로 전달받는 콜백. imageSize = inputSize(정사각). */
  onBoxes: (boxes: CloverDetectionBox[], imageSize: number) => void;
  /** false 면 로드/추론을 하지 않음 (스냅샷 엔진일 때). */
  enabled: boolean;
};

function pickDelegates(useGpu: boolean): TensorflowModelDelegate[] {
  if (!useGpu) {
    return []; // 빈 배열 = CPU (기본).
  }
  // 델리게이트 로드 실패 시 fast-tflite 가 CPU 로 폴백합니다.
  return Platform.OS === 'ios' ? ['core-ml'] : ['android-gpu'];
}

export function useCloverFrameProcessor(options: Options): {
  frameProcessor: ReadonlyFrameProcessor | undefined;
  modelState: OnDeviceModelState;
  errorMessage: string | null;
} {
  const { targetFps, onBoxes, enabled } = options;
  const { resize } = useResizePlugin();

  const [model, setModel] = useState<TensorflowModel | undefined>(undefined);
  const [modelState, setModelState] = useState<OnDeviceModelState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modelUri = ON_DEVICE_MODEL.modelUri;

  // 모델 로드: require() 대신 파일 URI 로드라 모델이 없어도 번들이 깨지지 않음.
  useEffect(() => {
    if (!enabled || !modelUri) {
      setModel(undefined);
      setModelState('idle');
      return;
    }

    let cancelled = false;
    setModelState('loading');
    setErrorMessage(null);

    loadTensorflowModel(
      { url: modelUri },
      pickDelegates(ON_DEVICE_MODEL.useGpuDelegate),
    )
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setModel(loaded);
        setModelState('loaded');
      })
      .catch((error: any) => {
        if (cancelled) {
          return;
        }
        setModel(undefined);
        setModelState('error');
        setErrorMessage(error?.message ?? 'Failed to load the on-device model.');
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, modelUri]);

  // worklet 안에서 안전하게 접근하려면 Nitro box 로 감싼다.
  const boxedModel = useMemo(
    () => (model != null ? NitroModules.box(model) : undefined),
    [model],
  );

  const deliverBoxes = useRunOnJS(onBoxes, [onBoxes]);

  const inputSize = ON_DEVICE_MODEL.inputSize;
  const decodeConfig = ON_DEVICE_MODEL.decode;

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (boxedModel == null) {
        return;
      }

      runAtTargetFps(targetFps, () => {
        'worklet';
        const tflite = boxedModel.unbox();

        // 프레임을 모델 입력 크기로 리사이즈 (rgb, float32 = 0.0~1.0).
        const resized = resize(frame, {
          scale: { width: inputSize, height: inputSize },
          pixelFormat: 'rgb',
          dataType: 'float32',
        });

        const inputBuffer = resized.buffer.slice(
          resized.byteOffset,
          resized.byteOffset + resized.byteLength,
        ) as ArrayBuffer;

        const outputs = tflite.runSync([inputBuffer]);
        const raw = new Float32Array(outputs[0]);
        const decoded = decodeYolo(raw, decodeConfig);

        const boxes: CloverDetectionBox[] = decoded.map((box) => ({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          confidence: box.confidence,
          rawLabel: 'four_leaf',
        }));

        deliverBoxes(boxes, inputSize);
      });
    },
    [boxedModel, resize, deliverBoxes, targetFps, inputSize, decodeConfig],
  );

  return {
    frameProcessor: enabled && boxedModel != null ? frameProcessor : undefined,
    modelState,
    errorMessage,
  };
}
