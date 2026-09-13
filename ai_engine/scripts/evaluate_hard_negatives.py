"""Measure false positives on held-out intact-road images for a checkpoint."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "ai_engine" / "data" / "processed" / "ruaskita-seg-v0.3"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--confidence", type=float, default=0.25)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default=0)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    image_root, label_root = args.data / "test" / "images", args.data / "test" / "labels"
    negatives = [image for image in sorted(image_root.iterdir()) if not (label_root / f"{image.stem}.txt").read_text(encoding="utf-8").strip()]
    if not negatives or not args.weights.exists():
        raise SystemExit("No held-out hard negatives or checkpoint missing.")

    model = YOLO(str(args.weights))
    predicted_images, predicted_instances = 0, 0
    examples: dict[str, list[str]] = {}
    with (args.data / "manifest.csv").open(newline="", encoding="utf-8") as file:
        sources = {row["sample_id"]: row["source"] for row in csv.DictReader(file)}
    by_source: dict[str, Counter[str]] = {}
    for image, result in zip(negatives, model.predict(source=[str(image) for image in negatives], conf=args.confidence, imgsz=args.imgsz, device=args.device, stream=True, verbose=False), strict=True):
        count = len(result.boxes) if result.boxes is not None else 0
        predicted_images += int(count > 0)
        predicted_instances += count
        source = sources[image.stem]
        stats = by_source.setdefault(source, Counter())
        stats["negative_images"] += 1
        stats["false_positive_images"] += int(count > 0)
        stats["false_positive_instances"] += count
        if count and len(examples.setdefault(source, [])) < 8:
            examples[source].append(str(image.resolve().relative_to(PROJECT_ROOT)))
    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "model": str(args.weights.resolve().relative_to(PROJECT_ROOT)),
        "dataset": args.data.name,
        "split": "test negatives only",
        "confidence_threshold": args.confidence,
        "negative_images": len(negatives),
        "false_positive_images": predicted_images,
        "false_positive_image_rate": predicted_images / len(negatives),
        "false_positive_instances": predicted_instances,
        "by_source": {
            source: {
                **stats,
                "false_positive_image_rate": stats["false_positive_images"] / stats["negative_images"],
                "example_predicted_negatives": examples.get(source, []),
            }
            for source, stats in sorted(by_source.items())
        },
    }
    output = args.output or (PROJECT_ROOT / "ai_engine" / "artifacts" / f"{args.weights.parent.parent.name}-hard-negative.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
