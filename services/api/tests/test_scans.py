import io
import json
import os
import tempfile
import unittest
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from services.api.app.main import app
from services.api.app.storage import database


class ScanTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"RUASKITA_DB": str(Path(self.folder.name) / "scan.sqlite3"), "RUASKITA_DISABLE_MODEL": "1"})
        self.env.start()
        self.context = TestClient(app)
        self.client = self.context.__enter__()
        self.base = datetime.now(UTC) - timedelta(seconds=25)
        out = io.BytesIO()
        Image.fromarray(np.random.default_rng(42).integers(0, 255, (180, 240, 3), dtype=np.uint8)).save(out, "PNG")
        self.image = out.getvalue()
        self.analysis = {"model_version": "RuasVision v0.3", "engine": "RuasVision v0.3", "confidence_threshold": 0.5,
                         "image_shape": {"width": 240, "height": 180}, "potholes": [{"confidence": .82, "polygon_xy": [[1, 1], [80, 1], [80, 80]]}]}
        self.predict = Mock(return_value=self.analysis)
        app.state.scan_predict = self.predict
        self.body = {"request_id": str(uuid.uuid4()), "road": "Jl. Scan Uji", "contributor": "Penguji"}
        self.session = self.client.post("/v1/scans", json=self.body).json()["id"]

    def tearDown(self):
        self.context.__exit__(None, None, None)
        self.env.stop()
        self.folder.cleanup()

    def frame(self, sequence, **changes):
        stamp = (self.base + timedelta(seconds=sequence * 2)).isoformat()
        meta = {"sequence": sequence, "captured_at": stamp, "gps_at": stamp,
                "latitude": -7.7956, "longitude": 110.3695, "accuracy_m": 12, **changes}
        return self.client.post(f"/v1/scans/{self.session}/frames", data={"metadata": json.dumps(meta)},
                                files={"image": ("frame.png", self.image, "image/png")})

    def test_two_frames_create_candidate_with_evidence_and_gps(self):
        self.assertIsNone(self.frame(1).json()["incident_id"])
        result = self.frame(2)
        self.assertEqual(result.status_code, 200, result.text)
        item = self.client.get(f'/v1/incidents/{result.json()["incident_id"]}').json()
        self.assertEqual(item["status"], "candidate")
        self.assertEqual(item["source"], "ai")
        self.assertEqual(item["gps_accuracy_m"], 12)
        self.assertEqual(item["model_version"], "RuasVision v0.3")
        evidence = self.client.get('/v1/evidence/' + item["observations"][0]["evidence_id"])
        self.assertEqual(evidence.status_code, 200)
        self.assertEqual(len(self.client.get(f"/v1/scans/{self.session}").json()["points"]), 2)

    def test_retries_are_idempotent_even_after_stop(self):
        first = self.frame(1)
        self.client.post(f"/v1/scans/{self.session}/stop")
        self.assertEqual(self.frame(1).json(), first.json())
        self.assertEqual(self.predict.call_count, 1)
        self.assertEqual(self.frame(2).status_code, 409)

    def test_same_sequence_with_different_payload_conflicts(self):
        self.frame(1)
        self.assertEqual(self.frame(1, accuracy_m=10).status_code, 409)

    def test_repeated_zone_is_not_many_incidents(self):
        for sequence in range(1, 6):
            self.assertEqual(self.frame(sequence).status_code, 200)
        self.assertEqual(len(self.client.get("/v1/incidents").json()), 1)

    def test_brief_missed_detection_does_not_duplicate_zone(self):
        self.frame(1)
        first = self.frame(2).json()["incident_id"]
        potholes = self.analysis["potholes"]
        self.analysis["potholes"] = []
        self.frame(3)
        self.analysis["potholes"] = potholes
        self.frame(4)
        self.assertEqual(self.frame(5).json()["incident_id"], first)
        self.assertEqual(len(self.client.get("/v1/incidents").json()), 1)

    def test_failed_candidate_write_rolls_back_evidence_and_frame(self):
        self.frame(1)
        with patch("services.api.app.scans.save_incident", side_effect=RuntimeError("write failed")):
            with self.assertRaises(RuntimeError):
                self.frame(2)
        with database() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM evidence").fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT count(*) FROM scan_frames").fetchone()[0], 1)
        self.assertEqual(self.frame(2).json()["incident_count"], 1)

    def test_negative_frames_record_coverage_not_healthy_claim(self):
        self.analysis["potholes"] = []
        result = self.frame(1).json()
        self.assertEqual(result["point"]["state"], "no_detection")
        self.assertIsNone(result["incident_id"])
        self.assertEqual(len(self.client.get("/v1/scans/coverage").json()), 1)

    def test_blurred_frames_are_uncertain_not_candidates(self):
        out = io.BytesIO()
        Image.new("RGB", (240, 180), "gray").save(out, "PNG")
        self.image = out.getvalue()
        self.frame(1)
        result = self.frame(2).json()
        self.assertEqual(result["point"]["state"], "uncertain")
        self.assertIsNone(result["incident_id"])

    def test_bad_accuracy_stale_gps_and_clock_rejected(self):
        self.assertEqual(self.frame(1, accuracy_m=100).status_code, 422)
        self.assertEqual(self.frame(1, gps_at=(self.base - timedelta(seconds=20)).isoformat()).status_code, 422)
        self.assertEqual(self.frame(1, captured_at=(self.base - timedelta(minutes=5)).isoformat()).status_code, 422)
        self.assertEqual(self.predict.call_count, 0)

    def test_out_of_order_and_gps_teleport_rejected(self):
        self.frame(2)
        self.assertEqual(self.frame(1).status_code, 409)
        self.assertEqual(self.frame(3, latitude=0).status_code, 422)

    def test_model_failure_does_not_save_fake_result(self):
        self.predict.side_effect = HTTPException(503, "Unavailable")
        self.assertEqual(self.frame(1).status_code, 503)
        self.assertEqual(self.client.get("/v1/scans/coverage").json(), [])

    def test_client_cannot_supply_detections(self):
        self.assertEqual(self.frame(1, analysis=self.analysis).status_code, 422)

    def test_session_retry_and_mismatch(self):
        self.assertEqual(self.client.post("/v1/scans", json=self.body).json()["id"], self.session)
        self.assertEqual(self.client.post("/v1/scans", json={**self.body, "road": "Ruas lain"}).status_code, 409)

    def test_new_schema_preserves_existing_data(self):
        with database() as db:
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 3)
            self.assertEqual(db.execute("SELECT count(*) FROM scan_sessions").fetchone()[0], 1)
