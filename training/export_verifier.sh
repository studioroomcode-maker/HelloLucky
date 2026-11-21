#!/usr/bin/env bash
# training/clover_verifier.onnx → assets/model/clover_verifier.tflite (fp16 weights, fp32 I/O).
# Usage (from repo root, Windows): wsl -d Ubuntu -- bash training/export_verifier.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
cp "$ROOT/training/clover_verifier.onnx" "$TMP/verifier.onnx"
cd "$TMP"
~/yolo83/bin/python -c "import numpy as np; np.save('calibration_image_sample_data_20x128x128x3_float32.npy', np.random.default_rng(1).random((20, 128, 128, 3), dtype=np.float32))"
~/yolo83/bin/onnx2tf -i verifier.onnx -o out -nuo > onnx2tf.log 2>&1 || { tail -40 onnx2tf.log; exit 1; }
~/yolo83/bin/python - <<'PY'
import numpy as np, onnxruntime as ort
from ai_edge_litert.interpreter import Interpreter
x = np.random.default_rng(0).random((1, 3, 224, 224), dtype=np.float32)
ref = ort.InferenceSession("verifier.onnx").run(None, {"images": x})[0]
it = Interpreter("out/verifier_float16.tflite"); it.allocate_tensors()
i, o = it.get_input_details()[0], it.get_output_details()[0]
it.set_tensor(i["index"], x.transpose(0, 2, 3, 1)); it.invoke()
got = it.get_tensor(o["index"])
print("tflite in", i["shape"], "out", o["shape"])
assert got.shape == ref.shape, (got.shape, ref.shape)
err = np.abs(got - ref).max()
print("max abs diff vs onnx", err)
assert err < 0.01, err
PY
cp out/verifier_float16.tflite "$ROOT/assets/model/clover_verifier.tflite"
ls -lh "$ROOT/assets/model/clover_verifier.tflite"
