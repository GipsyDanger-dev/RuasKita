"""Run a RuasVision checkpoint and emit web-friendly pothole polygons as JSON."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WEIGHTS = PROJECT_ROOT / "ai_engine" / "runs" / "yolo11n-seg-v0.3" / "weights" / "best.pt"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path, help="Road image to analyse.")
    parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--confidence", type=float, default=0.50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default=0)
    args = parser.parse_args()
    if not args.image.exists() or not args.weights.exists():
        raise SystemExit("Input image or segmentation checkpoint is missing.")

    result = YOLO(str(args.weights)).predict(
        source=str(args.image), conf=args.confidence, imgsz=args.imgsz,
        device=args.device, verbose=False,
    )[0]
    masks = result.masks.xy if result.masks is not None else []
    boxes = result.boxes
    potholes = []
    for index, polygon in enumerate(masks):
        potholes.append({
            "class": "pothole",
            "confidence": float(boxes.conf[index]),
            "bbox_xyxy": [float(value) for value in boxes.xyxy[index].tolist()],
            "polygon_xy": [[float(x), float(y)] for x, y in polygon.tolist()],
        })
    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "engine": "RuasVision v0.3",
        "model": str(args.weights.relative_to(PROJECT_ROOT)),
        "image": str(args.image),
        "image_shape": {"height": result.orig_shape[0], "width": result.orig_shape[1]},
        "confidence_threshold": args.confidence,
        "potholes": potholes,
        "depth_policy": "No centimetre depth is emitted; RuasDepth v0.1 uses relative transformed disparity only.",
    }
    output = args.output or (PROJECT_ROOT / "ai_engine" / "artifacts" / "predictions" / f"{args.image.stem}.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
