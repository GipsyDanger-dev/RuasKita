"""Dependency-free contract checks for RuasVision inference JSON responses."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"Contract violation: {message}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("response", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.response.read_text(encoding="utf-8"))
    required = {"generated_at", "engine", "model", "image", "image_shape", "confidence_threshold", "potholes", "depth_policy"}
    require(required <= payload.keys(), "missing required top-level field")
    require(re.fullmatch(r"RuasVision v0\.\d+", str(payload["engine"])) is not None, "invalid engine version")
    if "model_version" in payload:
        require(payload["model_version"] == payload["engine"], "model version must match engine release")
    require(isinstance(payload["confidence_threshold"], (int, float)) and 0 <= payload["confidence_threshold"] <= 1, "invalid confidence threshold")
    require(all(isinstance(payload["image_shape"].get(key), int) and payload["image_shape"][key] > 0 for key in ("height", "width")), "invalid image shape")
    require(isinstance(payload["potholes"], list), "potholes must be an array")
    for index, pothole in enumerate(payload["potholes"]):
        require(pothole.get("class") == "pothole", f"pothole {index} has invalid class")
        require(isinstance(pothole.get("confidence"), (int, float)) and 0 <= pothole["confidence"] <= 1, f"pothole {index} has invalid confidence")
        require(isinstance(pothole.get("bbox_xyxy"), list) and len(pothole["bbox_xyxy"]) == 4, f"pothole {index} has invalid bbox")
        polygon = pothole.get("polygon_xy")
        require(isinstance(polygon, list) and len(polygon) >= 3 and all(isinstance(point, list) and len(point) == 2 for point in polygon), f"pothole {index} has invalid polygon")
    print(f"CONTRACT_VALID engine={payload['engine']} potholes={len(payload['potholes'])}")


if __name__ == "__main__":
    main()
