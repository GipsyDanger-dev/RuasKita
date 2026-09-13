"""Train the reproducible RuasVision single-class segmentation baseline."""

from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "ai_engine" / "data" / "processed" / "ruaskita-seg-v0.3" / "data.yaml"
DEFAULT_RUNS = PROJECT_ROOT / "ai_engine" / "runs"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--model", default="yolo11n-seg.pt")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=-1, help="-1 lets Ultralytics select a safe batch size.")
    parser.add_argument("--device", default=0)
    parser.add_argument("--workers", type=int, default=0, help="Use 0 on this Windows GPU machine to avoid CUDA DLL paging failures in child workers.")
    parser.add_argument("--patience", type=int, default=20, help="Stop after this many validation epochs without improvement.")
    parser.add_argument("--exist-ok", action="store_true", help="Reuse an existing run directory; use only when intentionally restarting that named experiment.")
    parser.add_argument("--name", default="ruasvision-seg-v0.1")
    args = parser.parse_args()
    if not args.data.exists():
        raise SystemExit(f"Missing prepared dataset: {args.data}. Run prepare_segmentation_dataset.py first.")
    model = YOLO(args.model)
    model.train(data=str(args.data), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch, device=args.device, workers=args.workers, project=str(DEFAULT_RUNS), name=args.name, exist_ok=args.exist_ok, seed=42, deterministic=True, patience=args.patience, plots=True)


if __name__ == "__main__":
    main()
