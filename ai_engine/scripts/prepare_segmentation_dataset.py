"""Build a deduplicated, one-class YOLO segmentation dataset from raw inputs.

Raw inputs are never changed. Dataset4 supplies polygon labels; Pothole-600
(Dataset3) supplies semantic masks that are converted to polygon instances;
Dataset1 contributes only its folder-labelled normal-road hard negatives.
Unlabelled Dataset4 images are excluded by default after a label-quality audit
found clear potholes in samples with empty annotations.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import os
import shutil
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
import yaml
from PIL import Image, UnidentifiedImageError


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = PROJECT_ROOT / "Dataset"
DEFAULT_OUTPUT = PROJECT_ROOT / "ai_engine" / "data" / "processed" / "ruaskita-seg-v0.3"
SPLITS = ("train", "val", "test")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def deterministic_split(key: str) -> str:
    # Stable allocation by unique image content: 70/15/15.
    bucket = int(key[:8], 16) % 100
    return "train" if bucket < 70 else "val" if bucket < 85 else "test"


def hardlink_or_copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def is_supported_raster(path: Path) -> bool:
    """Accept only formats that the YOLO image loader supports for this build."""
    try:
        with Image.open(path) as image:
            return image.format in {"JPEG", "PNG"}
    except (UnidentifiedImageError, OSError):
        return False


def validate_polygon_row(row: str) -> str | None:
    fields = row.strip().split()
    if len(fields) < 7 or len(fields) % 2 == 0:
        return None
    try:
        values = [float(value) for value in fields[1:]]
    except ValueError:
        return None
    if not all(0.0 <= value <= 1.0 for value in values):
        return None
    # All Dataset4 classes map to pothole class id 0.
    return "0 " + " ".join(f"{value:.6f}" for value in values)


def polygons_from_mask(mask_path: Path) -> list[str]:
    mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
    if mask is None:
        raise RuntimeError(f"Unreadable mask: {mask_path}")
    height, width = mask.shape
    values, counts = np.unique(mask, return_counts=True)
    background = values[int(np.argmax(counts))]
    binary = (mask != background).astype(np.uint8) * 255
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    labels: list[str] = []
    for contour in contours:
        if cv2.contourArea(contour) < 4:
            continue
        epsilon = 0.002 * cv2.arcLength(contour, True)
        polygon = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2)
        if len(polygon) < 3:
            continue
        normalized = []
        for x, y in polygon:
            normalized.extend((min(max(x / width, 0), 1), min(max(y / height, 0), 1)))
        labels.append("0 " + " ".join(f"{point:.6f}" for point in normalized))
    return labels


def write_sample(
    image: Path,
    labels: list[str],
    split: str,
    sample_id: str,
    output: Path,
) -> None:
    image_target = output / split / "images" / f"{sample_id}{image.suffix.lower()}"
    label_target = output / split / "labels" / f"{sample_id}.txt"
    hardlink_or_copy(image, image_target)
    label_target.parent.mkdir(parents=True, exist_ok=True)
    label_target.write_text("\n".join(labels) + ("\n" if labels else ""), encoding="utf-8")


def add_dataset4(output: Path, seen_hashes: set[str], manifest: list[dict[str, str]], include_unlabeled: bool) -> Counter:
    stats: Counter = Counter()
    image_root = RAW_ROOT / "Dataset4"
    for split_dir in ("train", "valid", "test"):
        for image in sorted((image_root / split_dir / "images").glob("*.jpg")):
            label_path = image_root / split_dir / "labels" / f"{image.stem}.txt"
            if not label_path.exists():
                stats["missing_label"] += 1
                continue
            image_hash = sha256(image)
            if image_hash in seen_hashes:
                stats["duplicate_skipped"] += 1
                continue
            raw_rows = [row for row in label_path.read_text(encoding="utf-8").splitlines() if row.strip()]
            labels = [normalized for row in raw_rows if (normalized := validate_polygon_row(row))]
            # Dataset4 empty annotations are not reliably negative: label audit
            # found obvious potholes in them. Keep only when explicitly asked.
            if raw_rows and not labels:
                stats["invalid_label"] += 1
                continue
            if not raw_rows and not include_unlabeled:
                stats["unlabeled_dataset4_excluded"] += 1
                continue
            seen_hashes.add(image_hash)
            split = deterministic_split(image_hash)
            sample_id = f"d4_{image_hash[:16]}"
            write_sample(image, labels, split, sample_id, output)
            manifest.append({"sample_id": sample_id, "source": "Dataset4", "source_path": str(image.relative_to(PROJECT_ROOT)), "sha256": image_hash, "split": split, "label_type": "polygon"})
            stats[f"kept_{split}"] += 1
            if not labels:
                stats["kept_negative"] += 1
    return stats


def add_dataset1_normal(output: Path, seen_hashes: set[str], manifest: list[dict[str, str]]) -> Counter:
    """Add classification-only normal road images as valid empty-mask samples.

    Dataset1 pothole images have no polygons, so including them would teach the
    segmentation model false geometry. Its normal folder is safe hard-negative
    supervision and helps reduce false positives on intact roads.
    """
    stats: Counter = Counter()
    normal_root = RAW_ROOT / "Dataset1" / "normal"
    for image in sorted(path for path in normal_root.iterdir() if path.suffix.lower() in {".jpg", ".jpeg", ".png"}):
        # A small number of classification files may have a misleading suffix
        # (for example GIF bytes named .jpg). YOLO rejects those at scan time.
        if not is_supported_raster(image):
            stats["unsupported_image"] += 1
            continue
        image_hash = sha256(image)
        if image_hash in seen_hashes:
            stats["duplicate_skipped"] += 1
            continue
        seen_hashes.add(image_hash)
        split = deterministic_split(image_hash)
        sample_id = f"d1normal_{image_hash[:16]}"
        write_sample(image, [], split, sample_id, output)
        manifest.append({"sample_id": sample_id, "source": "Dataset1-normal", "source_path": str(image.relative_to(PROJECT_ROOT)), "sha256": image_hash, "split": split, "label_type": "classification-normal-hard-negative"})
        stats[f"kept_{split}"] += 1
        stats["kept_negative"] += 1
    return stats


def add_pothole600(output: Path, seen_hashes: set[str], manifest: list[dict[str, str]]) -> Counter:
    stats: Counter = Counter()
    dataset_root = RAW_ROOT / "Dataset3" / "pothole600"
    split_map = {"training": "train", "validation": "val", "testing": "test"}
    for source_split, split in split_map.items():
        for image in sorted((dataset_root / source_split / "rgb").glob("*.png")):
            mask = dataset_root / source_split / "label" / image.name
            disparity = dataset_root / source_split / "tdisp" / image.name
            if not mask.exists() or not disparity.exists():
                stats["missing_pair"] += 1
                continue
            image_hash = sha256(image)
            if image_hash in seen_hashes:
                stats["duplicate_skipped"] += 1
                continue
            labels = polygons_from_mask(mask)
            seen_hashes.add(image_hash)
            sample_id = f"p600_{source_split}_{image.stem}"
            write_sample(image, labels, split, sample_id, output)
            manifest.append({"sample_id": sample_id, "source": "Pothole-600", "source_path": str(image.relative_to(PROJECT_ROOT)), "sha256": image_hash, "split": split, "label_type": "semantic-mask-to-polygon", "disparity_path": str(disparity.relative_to(PROJECT_ROOT))})
            stats[f"kept_{split}"] += 1
            if not labels:
                stats["kept_negative"] += 1
    return stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--overwrite", action="store_true", help="Replace a previously generated output directory.")
    parser.add_argument("--include-unlabeled-dataset4", action="store_true", help="Include Dataset4 empty labels; disabled by default because their negative label quality is unreliable.")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        if not args.overwrite:
            raise SystemExit(f"Output exists: {output}. Pass --overwrite to regenerate it.")
        shutil.rmtree(output)
    if not RAW_ROOT.exists():
        raise SystemExit(f"Raw dataset folder not found: {RAW_ROOT}")

    manifest: list[dict[str, str]] = []
    seen_hashes: set[str] = set()
    stats = Counter()
    stats.update(add_dataset4(output, seen_hashes, manifest, args.include_unlabeled_dataset4))
    stats.update(add_pothole600(output, seen_hashes, manifest))
    stats.update(add_dataset1_normal(output, seen_hashes, manifest))
    for split in SPLITS:
        (output / split / "images").mkdir(parents=True, exist_ok=True)
        (output / split / "labels").mkdir(parents=True, exist_ok=True)
    with (output / "manifest.csv").open("w", newline="", encoding="utf-8") as file:
        fields = ["sample_id", "source", "source_path", "sha256", "split", "label_type", "disparity_path"]
        writer = csv.DictWriter(file, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(manifest)
    (output / "data.yaml").write_text(yaml.safe_dump({"path": str(output), "train": "train/images", "val": "val/images", "test": "test/images", "names": {0: "pothole"}}, sort_keys=False), encoding="utf-8")
    (output / "build_report.yaml").write_text(yaml.safe_dump({"dataset": "ruaskita-seg-v0.3", "samples": len(manifest), "stats": dict(stats), "class_map": {"0": "pothole"}, "notes": ["Dataset4 and Dataset1-normal exact duplicates are excluded before deterministic splitting.", "Dataset4 empty labels are excluded because visual audit found unlabelled potholes.", "Dataset1 normal images are retained as hard negatives; Dataset1 pothole images are excluded because they have no segmentation masks.", "Pothole-600 split is kept official; tdisp stays external to YOLO labels for depth research."]}, sort_keys=False), encoding="utf-8")
    print(yaml.safe_dump({"output": str(output), "samples": len(manifest), "stats": dict(stats)}, sort_keys=False))


if __name__ == "__main__":
    main()
