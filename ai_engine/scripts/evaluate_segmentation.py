"""Evaluate a trained RuasVision segmentation checkpoint on an isolated split."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "ai_engine" / "data" / "processed" / "ruaskita-seg-v0.3" / "data.yaml"
DEFAULT_WEIGHTS = PROJECT_ROOT / "ai_engine" / "runs" / "yolo11n-seg-v0.3" / "weights" / "best.pt"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default=0)
    args = parser.parse_args()
    if not args.data.exists() or not args.weights.exists():
        raise SystemExit("Prepared data or trained weights are missing.")

    run_name = args.weights.parent.parent.name
    dataset_root = args.data.resolve().parent
    test_samples = sum(1 for path in (dataset_root / "test" / "images").iterdir() if path.is_file())
    metrics = YOLO(str(args.weights)).val(
        data=str(args.data), split="test", imgsz=args.imgsz, batch=args.batch,
        device=args.device, workers=0, plots=True,
        project=str(PROJECT_ROOT / "ai_engine" / "runs"), name=f"{run_name}-test",
        exist_ok=True,
    )
    output = args.output or (PROJECT_ROOT / "ai_engine" / "artifacts" / f"{run_name}-test.json")
    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "model": str(args.weights.resolve().relative_to(PROJECT_ROOT)),
        "dataset": dataset_root.name,
        "split": "test",
        "samples": test_samples,
        "box_map50": metrics.box.map50,
        "box_map50_95": metrics.box.map,
        "mask_precision": metrics.seg.mp,
        "mask_recall": metrics.seg.mr,
        "mask_map50": metrics.seg.map50,
        "mask_map50_95": metrics.seg.map,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
