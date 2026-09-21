"""Regression checks for the frozen RuasVision release metadata."""

from __future__ import annotations

import json
import hashlib
import re
import unittest
from pathlib import Path

import yaml
from ai_engine.scripts.validate_inference_contract import validate_payload


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "ai_engine" / "config" / "ruasvision-release-v0.3.yaml"
CONTRACT = ROOT / "ai_engine" / "contracts" / "ruasvision-inference-v0.2.schema.json"


class ReleaseContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
        cls.contract = json.loads(CONTRACT.read_text(encoding="utf-8"))

    def test_manifest_is_frozen_and_versioned(self):
        self.assertEqual(self.manifest["status"], "frozen-offline-release")
        self.assertRegex(self.manifest["release"], r"^RuasVision v0\.\d+$")
        self.assertRegex(self.manifest["checkpoint_sha256"], r"^[0-9a-f]{64}$")

    def test_available_checkpoint_matches_manifest(self):
        checkpoint = ROOT / self.manifest["checkpoint"]
        if not checkpoint.exists():
            self.skipTest("frozen checkpoint is not present in this checkout")
        digest = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
        self.assertEqual(digest, self.manifest["checkpoint_sha256"])

    def test_benchmark_values_are_bounded(self):
        metrics = self.manifest["test_metrics"]
        self.assertGreater(metrics["samples"], 0)
        for key, value in metrics.items():
            if key != "samples":
                self.assertGreaterEqual(value, 0)
                self.assertLessEqual(value, 1)

    def test_contract_keeps_required_fields_stable(self):
        self.assertEqual(
            set(self.contract["required"]),
            {
                "generated_at",
                "engine",
                "model",
                "image",
                "image_shape",
                "confidence_threshold",
                "potholes",
                "depth_policy",
            },
        )
        self.assertEqual(self.contract["properties"]["engine"]["pattern"], r"^RuasVision v0\.[0-9]+$")

    def test_validator_accepts_versioned_inference_payload(self):
        validate_payload(
            {
                "generated_at": "2026-09-21T00:00:00+00:00",
                "engine": "RuasVision v0.3",
                "model_version": "RuasVision v0.3",
                "model": "ai_engine/runs/example.pt",
                "image": "road.png",
                "image_shape": {"height": 100, "width": 120},
                "confidence_threshold": 0.5,
                "potholes": [
                    {
                        "class": "pothole",
                        "confidence": 0.91,
                        "bbox_xyxy": [1, 2, 30, 40],
                        "polygon_xy": [[1, 2], [30, 2], [30, 40]],
                    }
                ],
                "depth_policy": "relative only",
            }
        )

    def test_validator_rejects_model_version_drift(self):
        with self.assertRaisesRegex(SystemExit, "model version must match"):
            validate_payload(
                {
                    "generated_at": "2026-09-21T00:00:00+00:00",
                    "engine": "RuasVision v0.3",
                    "model_version": "RuasVision v0.2",
                    "model": "ai_engine/runs/example.pt",
                    "image": "road.png",
                    "image_shape": {"height": 100, "width": 120},
                    "confidence_threshold": 0.5,
                    "potholes": [],
                    "depth_policy": "relative only",
                }
            )
