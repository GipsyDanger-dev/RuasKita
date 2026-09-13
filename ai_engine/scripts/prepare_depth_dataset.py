"""Prepare Pothole-600 for depth-aware segmentation experiments.

The input called ``tdisp`` is transformed disparity (relative/inverse depth),
not a calibrated metric depth map. This dataset is therefore explicitly marked
research-only and never produces centimetre measurements.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import os
import shutil
from pathlib import Path

import yaml


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = PROJECT_ROOT / "Dataset" / "Dataset3" / "pothole600"
DEFAULT_OUTPUT = PROJECT_ROOT / "ai_engine" / "data" / "processed" / "ruaskita-depth-aware-v0.1"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hardlink_or_copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        if not args.overwrite:
            raise SystemExit(f"Output exists: {output}. Pass --overwrite to regenerate it.")
        shutil.rmtree(output)
    if not RAW_ROOT.exists():
        raise SystemExit(f"Pothole-600 not found: {RAW_ROOT}")

    split_map = {"training": "train", "validation": "val", "testing": "test"}
    rows: list[dict[str, str]] = []
    for raw_split, split in split_map.items():
        for rgb in sorted((RAW_ROOT / raw_split / "rgb").glob("*.png")):
            tdisp = RAW_ROOT / raw_split / "tdisp" / rgb.name
            mask = RAW_ROOT / raw_split / "label" / rgb.name
            if not tdisp.exists() or not mask.exists():
                raise RuntimeError(f"Missing paired modality for {rgb}")
            for modality, source in (("rgb", rgb), ("tdisp", tdisp), ("mask", mask)):
                hardlink_or_copy(source, output / split / modality / rgb.name)
            rows.append({"sample_id": f"p600_{raw_split}_{rgb.stem}", "split": split, "rgb_sha256": sha256(rgb), "rgb": str(rgb.relative_to(PROJECT_ROOT)), "tdisp": str(tdisp.relative_to(PROJECT_ROOT)), "mask": str(mask.relative_to(PROJECT_ROOT))})

    with (output / "manifest.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    metadata = {
        "dataset": "ruaskita-depth-aware-v0.1",
        "source": "Pothole-600",
        "samples": len(rows),
        "splits": {split: sum(row["split"] == split for row in rows) for split in ("train", "val", "test")},
        "input": "RGB + transformed disparity",
        "target": "binary pothole segmentation mask",
        "measurement_policy": "Relative-depth research only. Never present tdisp-derived values as centimetres or inspection-grade measurements.",
    }
    (output / "metadata.yaml").write_text(yaml.safe_dump(metadata, sort_keys=False), encoding="utf-8")
    print(yaml.safe_dump(metadata, sort_keys=False))


if __name__ == "__main__":
    main()
