"""
YOLOX-Tiny (Apache-2.0) luck detector. Data: training/build_yolox_data.py.

Train (from repo root):
  set PYTHONPATH=training/third_party/YOLOX
  python training/third_party/YOLOX/tools/train.py -f training/yolox_exp.py -d 1 -b 16 --fp16 -c training/yolox_tiny.pth
"""
from pathlib import Path

from yolox.exp import Exp as BaseExp

ROOT = Path(__file__).resolve().parent


class Exp(BaseExp):
    def __init__(self):
        super().__init__()
        self.depth = 0.33
        self.width = 0.375
        self.num_classes = 2  # 0 four_leaf (the only one the app alerts on), 1 three_leaf
        # Must match INPUT_SIZE in src/config/detector.ts.
        self.input_size = (960, 960)
        self.test_size = (960, 960)
        self.multiscale_range = 3
        self.data_dir = str(ROOT / "yolox_data")
        self.train_ann = "instances_train2017.json"
        self.val_ann = "instances_val2017.json"
        self.output_dir = str(ROOT / "YOLOX_outputs")
        self.exp_name = "luck_tiny"
        # Seen from above a clover has no "up".
        self.degrees = 180.0
        self.mosaic_scale = (0.3, 1.5)
        self.enable_mixup = False
        self.max_epoch = 70
        self.no_aug_epochs = 10
        self.warmup_epochs = 3
        self.eval_interval = 5
        self.data_num_workers = 12
