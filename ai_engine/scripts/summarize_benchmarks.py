"""Create a concise, machine-readable comparison of completed AI benchmarks."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import UTC, datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RUNS = PROJECT_ROOT / "ai_engine" / "runs"
DEFAULT_OUTPUT = PROJECT_ROOT / "ai_engine" / "artifacts" / "benchmark-report-v0.3.json"
DEFAULT_ELIGIBLE_RUNS = ("yolo11n-seg-v0.3-comparison", "yolo11s-seg-v0.3-comparison")


def last_row(path: Path) -> dict[str, str] | None:
    if not path.exists():
        return None
    with path.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
    return rows[-1] if rows else None


def number(row: dict[str, str], key: str) -> float | None:
    value = row.get(key)
    return float(value) if value not in (None, "") else None


def test_evaluations() -> dict[str, dict[str, object]]:
    """Index separately produced held-out test evaluations by their training run."""
    evaluations: dict[str, dict[str, object]] = {}
    for report_path in (PROJECT_ROOT / "ai_engine" / "artifacts").glob("*-test.json"):
        report = json.loads(report_path.read_text(encoding="utf-8"))
        model_path = Path(str(report.get("model", "")))
        parts = model_path.parts
        if "runs" in parts:
            index = parts.index("runs")
            if index + 1 < len(parts):
                evaluations[parts[index + 1]] = report
    return evaluations


def optional_artifact(name: str) -> dict[str, object] | None:
    path = PROJECT_ROOT / "ai_engine" / "artifacts" / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=Path, default=DEFAULT_RUNS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dataset", default="ruaskita-seg-v0.3", help="Only compare runs evaluated against this exact dataset version.")
    parser.add_argument("--eligible-runs", nargs="+", default=list(DEFAULT_ELIGIBLE_RUNS), help="Only independently pretrained comparison runs eligible for release selection.")
    args = parser.parse_args()
    candidates = []
    evaluations = test_evaluations()
    for results in sorted(args.runs.glob("*/results.csv")):
        row = last_row(results)
        if row is None:
            continue
        evaluation = evaluations.get(results.parent.name)
        if (results.parent.name not in args.eligible_runs or evaluation is None
                or evaluation.get("dataset") != args.dataset):
            continue
        candidates.append({
            "name": results.parent.name,
            "framework": "Ultralytics YOLO segmentation",
            "results_csv": str(results.relative_to(PROJECT_ROOT)),
            "epoch": number(row, "epoch"),
            "box_map50_95": number(row, "metrics/mAP50-95(B)"),
            "mask_map50_95": number(row, "metrics/mAP50-95(M)"),
            "mask_map50": number(row, "metrics/mAP50(M)"),
            "precision": number(row, "metrics/precision(M)"),
            "recall": number(row, "metrics/recall(M)"),
            "held_out_test": evaluation,
        })
    depth_report = PROJECT_ROOT / "ai_engine" / "artifacts" / "depth-aware-v0.1" / "report.json"
    depth = json.loads(depth_report.read_text(encoding="utf-8")) if depth_report.exists() else None
    evaluated = [candidate for candidate in candidates if candidate["held_out_test"] is not None]
    winner = max(evaluated, key=lambda candidate: candidate["held_out_test"]["mask_map50_95"]) if evaluated else None
    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "dataset": args.dataset,
        "candidates": candidates,
        "selection": {
            "recommended_segmentation_run": winner["name"] if winner else None,
            "criterion": "Highest held-out test mask mAP50-95.",
            "note": "Only independently pretrained runs evaluated on the exact same dataset version are ranked. Incumbent or continuation runs are historical evidence, not directly comparable release candidates.",
        },
        "operating_point": optional_artifact(f"{winner['name']}-presence-conf050.json") if winner else None,
        "hard_negative_check": optional_artifact(f"{winner['name']}-hard-negative.json") if winner else None,
        "depth_aware": depth,
        "measurement_policy": "Depth-aware results from transformed disparity are relative-depth research only, never centimetre measurements.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
