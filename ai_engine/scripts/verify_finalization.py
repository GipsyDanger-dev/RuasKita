"""Validate the fair-comparison evidence required to freeze RuasVision."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ARTIFACTS = PROJECT_ROOT / "ai_engine" / "artifacts"
DEFAULT_CANDIDATES = ("yolo11n-seg-v0.3-comparison", "yolo11s-seg-v0.3-comparison")


def load_json(path: Path) -> dict[str, object]:
    if not path.exists():
        raise ValueError(f"Missing required evidence: {path.relative_to(PROJECT_ROOT)}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON in {path.relative_to(PROJECT_ROOT)}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path.relative_to(PROJECT_ROOT)}")
    return value


def model_run_name(report: dict[str, object]) -> str:
    model = str(report.get("model", "")).replace("\\", "/")
    parts = Path(model).parts
    if "runs" not in parts:
        return ""
    index = parts.index("runs")
    return parts[index + 1] if index + 1 < len(parts) else ""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate_candidate(artifacts: Path, candidate: str, dataset: str) -> dict[str, object]:
    test = load_json(artifacts / f"{candidate}-test.json")
    presence = load_json(artifacts / f"{candidate}-presence-conf050.json")
    hard_negative = load_json(artifacts / f"{candidate}-hard-negative.json")
    reports = (test, presence, hard_negative)
    for report in reports:
        require(report.get("dataset") == dataset, f"{candidate}: report dataset does not equal {dataset}.")
        require(model_run_name(report) == candidate, f"{candidate}: report model does not point to this candidate run.")
    require(test.get("split") == "test", f"{candidate}: held-out evaluation must use test split.")
    require(isinstance(test.get("mask_map50_95"), (int, float)), f"{candidate}: missing test mask_map50_95.")
    require(presence.get("split") == "test", f"{candidate}: presence evaluation must use test split.")
    require(presence.get("confidence_threshold") == 0.5, f"{candidate}: presence evaluation must use confidence 0.50.")
    require(hard_negative.get("confidence_threshold") == 0.25, f"{candidate}: hard-negative evaluation must use confidence 0.25.")
    require(hard_negative.get("negative_images", 0) > 0, f"{candidate}: hard-negative set is empty.")
    return {
        "candidate": candidate,
        "test_mask_map50_95": test["mask_map50_95"],
        "test_mask_map50": test.get("mask_map50"),
        "test_mask_precision": test.get("mask_precision"),
        "test_mask_recall": test.get("mask_recall"),
        "presence_false_positive_rate": presence.get("negative_false_positive_rate"),
        "hard_negative_false_positive_rate": hard_negative.get("false_positive_image_rate"),
        "evidence": {
            "test": str((artifacts / f"{candidate}-test.json").relative_to(PROJECT_ROOT)),
            "presence": str((artifacts / f"{candidate}-presence-conf050.json").relative_to(PROJECT_ROOT)),
            "hard_negative": str((artifacts / f"{candidate}-hard-negative.json").relative_to(PROJECT_ROOT)),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify release evidence for the two final RuasVision candidates.")
    parser.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    parser.add_argument("--dataset", default="ruaskita-seg-v0.3")
    parser.add_argument("--candidates", nargs="+", default=list(DEFAULT_CANDIDATES))
    parser.add_argument("--output", type=Path, default=DEFAULT_ARTIFACTS / "finalization-decision-v0.3.json")
    args = parser.parse_args()
    if len(args.candidates) != 2:
        raise SystemExit("Exactly two final candidates are required for a fair release comparison.")
    try:
        evidence = [validate_candidate(args.artifacts, candidate, args.dataset) for candidate in args.candidates]
    except ValueError as error:
        raise SystemExit(f"Finalization blocked: {error}") from error
    winner = max(evidence, key=lambda item: float(item["test_mask_map50_95"]))
    decision = {
        "generated_at": datetime.now(UTC).isoformat(),
        "dataset": args.dataset,
        "selection_criterion": "Highest held-out test mask mAP50-95; review any operational regression before release.",
        "candidates": evidence,
        "recommended_winner": winner["candidate"],
        "status": "evidence-complete-for-offline-freeze",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(decision, indent=2), encoding="utf-8")
    print(json.dumps(decision, indent=2))


if __name__ == "__main__":
    main()
