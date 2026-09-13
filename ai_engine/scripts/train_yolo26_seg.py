"""Screen the locally available YOLO26n backbone with a segmentation head."""

from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO
import ultralytics


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "ai_engine" / "data" / "processed" / "ruaskita-seg-v0.1" / "data.yaml"
DEFAULT_CONFIG = Path(ultralytics.__file__).resolve().parent / "cfg" / "models" / "26" / "yolo26-seg.yaml"
DEFAULT_BACKBONE = PROJECT_ROOT / "weights" / "yolo26n.pt"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--backbone", type=Path, default=DEFAULT_BACKBONE)
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default=0)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--name", default="yolo26n-seg-screen-v0.1")
    args = parser.parse_args()
    if not all(path.exists() for path in (args.data, args.config, args.backbone)):
        raise SystemExit("Prepared data, YOLO26 segmentation config, or local backbone is missing.")
    model = YOLO(str(args.config))
    model.load(str(args.backbone))
    model.train(
        data=str(args.data), epochs=args.epochs, imgsz=args.imgsz, batch=-1,
        device=args.device, workers=args.workers, project=str(PROJECT_ROOT / "ai_engine" / "runs"),
        name=args.name, seed=42, deterministic=True, patience=10, plots=True,
    )


if __name__ == "__main__":
    main()
