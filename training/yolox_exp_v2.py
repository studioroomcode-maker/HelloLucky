"""
YOLOX-Tiny v2 fine-tune: trains on the cleaned dataset (resolved three_leaf label conflict
+ overlapped three-leaf hard negative decoys + field & close-up scales), warm-started from
YOLOX_outputs/luck_tiny/best_ckpt.pth.

Train (from repo root):
  $env:PYTHONPATH="training/third_party/YOLOX"
  python training/third_party/YOLOX/tools/train.py -f training/yolox_exp_v2.py -d 1 -b 16 --fp16 -c training/YOLOX_outputs/luck_tiny/best_ckpt.pth
"""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def _load_base():
    spec = importlib.util.spec_from_file_location("yolox_exp_base", ROOT / "yolox_exp.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.Exp


BaseLuckExp = _load_base()


class Exp(BaseLuckExp):
    def __init__(self):
        super().__init__()
        self.exp_name = "luck_tiny_v2"
        # Warm-start directly in no-mosaic + L1 refinement mode (best_ckpt.pth already had 60 mosaic epochs + 10 no_aug).
        # Starting with heavy mosaic disrupts the converged BN stats & L1 head; warmcos decays cleanly from 2.5e-4 → 0.
        self.scheduler = "warmcos"
        self.basic_lr_per_img = 0.001 / 64.0
        self.max_epoch = 12
        self.no_aug_epochs = 12
        self.warmup_epochs = 1
        self.eval_interval = 1
        self.data_num_workers = 6
