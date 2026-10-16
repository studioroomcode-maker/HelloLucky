#!/usr/bin/env bash
# training/yolox_luck.onnx (python training/export_yolox.py) → assets/model/clover.tflite (fp16 weights, fp32 I/O).
# onnx2tf only runs on Linux/macOS, so on Windows this runs inside WSL.
# One-time WSL setup (no sudo):
#   curl -LsSf https://astral.sh/uv/install.sh | sh
#   ~/.local/bin/uv venv ~/yolo83 --python 3.11 --seed
#   ~/.local/bin/uv pip install --python ~/yolo83/bin/python tensorflow-cpu==2.19.0 tf_keras==2.19.0 \
#     'onnx2tf>=1.26.3,<1.29' sng4onnx onnx_graphsurgeon 'onnx<1.18' onnxruntime ai-edge-litert
# Usage (from repo root, Windows): wsl -d Ubuntu -- bash training/export_tflite.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
cp "$ROOT/training/yolox_luck.onnx" "$TMP/luck.onnx"
cd "$TMP"
# onnx2tf downloads a pickled sample file that new numpy refuses; a local file with that name is used instead.
~/yolo83/bin/python -c "import numpy as np; np.save('calibration_image_sample_data_20x128x128x3_float32.npy', np.random.default_rng(1).random((20, 128, 128, 3), dtype=np.float32))"
~/yolo83/bin/onnx2tf -i luck.onnx -o out -nuo > onnx2tf.log 2>&1 || { tail -40 onnx2tf.log; exit 1; }
# Same input on both runtimes must give the same boxes, or the app would decode garbage.
~/yolo83/bin/python - <<'PY'
import numpy as np, onnxruntime as ort
from ai_edge_litert.interpreter import Interpreter
x = np.random.default_rng(0).random((1, 3, 960, 960), dtype=np.float32)
ref = ort.InferenceSession("luck.onnx").run(None, {"images": x})[0]
it = Interpreter("out/luck_float16.tflite"); it.allocate_tensors()
i, o = it.get_input_details()[0], it.get_output_details()[0]
it.set_tensor(i["index"], x.transpose(0, 2, 3, 1)); it.invoke()
got = it.get_tensor(o["index"])
print("tflite in", i["shape"], "out", o["shape"])
assert got.shape == ref.shape, (got.shape, ref.shape)
err = np.abs(got - ref).max()
print("max abs diff vs onnx", err)
assert err < 0.02, err
PY
cp out/luck_float16.tflite "$ROOT/assets/model/clover.tflite"
ls -la "$ROOT/assets/model/clover.tflite"
