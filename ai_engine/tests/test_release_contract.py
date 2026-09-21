"""Regression checks for the frozen RuasVision release metadata."""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

import yaml


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
