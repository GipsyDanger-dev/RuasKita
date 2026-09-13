"""Evaluate image-level pothole alert behaviour at a fixed confidence threshold.

This is an operating-point diagnostic, not a replacement for mask mAP: a
positive image is counted as detected when it has at least one prediction.
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "ai_engine" / "data" / "processed" / "ruaskita-seg-v0.3"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--confidence", type=float, default=0.70)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default=0)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    image_root, label_root = args.data / "test" / "images", args.data / "test" / "labels"
    images = sorted(path for path in image_root.iterdir() if path.is_file())
    if not images or not args.weights.exists():
        raise SystemExit("No test images or checkpoint missing.")

    counts = {"tp": 0, "fp": 0, "tn": 0, "fn": 0}
    model = YOLO(str(args.weights))
    for result in model.predict(source=str(image_root), conf=args.confidence, imgsz=args.imgsz, device=args.device, stream=True, verbose=False):
        ground_truth = (label_root / f"{Path(result.path).stem}.txt").read_text(encoding="utf-8").strip()
        positive, predicted = bool(ground_truth), result.boxes is not None and len(result.boxes) > 0
        if positive and predicted:
            counts["tp"] += 1
        elif positive:
            counts["fn"] += 1
        elif predicted:
            counts["fp"] += 1
        else:
            counts["tn"] += 1
    precision = counts["tp"] / max(counts["tp"] + counts["fp"], 1)
    recall = counts["tp"] / max(counts["tp"] + counts["fn"], 1)
    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "model": str(args.weights.resolve().relative_to(PROJECT_ROOT)),
        "dataset": args.data.name,
        "split": "test",
        "confidence_threshold": args.confidence,
        "metric_scope": "Image-level presence at fixed confidence; not mask IoU/mAP.",
        "counts": counts,
        "image_precision": precision,
        "image_recall": recall,
        "negative_false_positive_rate": counts["fp"] / max(counts["fp"] + counts["tn"], 1),
    }
    output = args.output or (PROJECT_ROOT / "ai_engine" / "artifacts" / f"{args.weights.parent.parent.name}-presence-conf{int(args.confidence * 100):03d}.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
