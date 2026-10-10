"""Opt-in real-weight integration smoke; never writes to the working database."""
import json
import os
import tempfile
import unittest
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from services.api.app.main import app, PROJECT_ROOT


@unittest.skipUnless(os.getenv("RUASKITA_REAL_SCAN_SMOKE") == "1", "Real GPU model smoke is opt-in")
class RealScanModelSmoke(unittest.TestCase):
    def test_real_checkpoint_frame_to_database(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
            "RUASKITA_DB": str(Path(folder) / "smoke.sqlite3"), "RUASKITA_DISABLE_MODEL": "0",
        }), TestClient(app) as client:
            self.assertTrue(client.get("/health").json()["model_loaded"])
            image = (PROJECT_ROOT / "apps/web/public/brand/road-evidence.jpg").read_bytes()
            session = client.post("/v1/scans", json={"request_id": str(uuid.uuid4()), "road": "Smoke test only", "contributor": "Automated smoke"}).json()
            results = []
            for sequence in (1, 2):
                stamp = (datetime.now(UTC) - timedelta(seconds=2)).isoformat()
                meta = {"sequence": sequence, "captured_at": stamp, "gps_at": stamp, "latitude": -7.7956,
                        "longitude": 110.3695, "accuracy_m": 10}
                response = client.post(f'/v1/scans/{session["id"]}/frames', data={"metadata": json.dumps(meta)},
                                       files={"image": ("road.jpg", image, "image/jpeg")})
                self.assertEqual(response.status_code, 200, response.text)
                results.append(response.json())
            self.assertEqual(results[-1]["frame_count"], 2)
            self.assertEqual(results[-1]["analysis"]["model_version"], "RuasVision v0.3")
            print("REAL SCAN SMOKE: " + json.dumps({"detections": len(results[-1]["analysis"]["potholes"]),
                  "state": results[-1]["point"]["state"], "incident_count": results[-1]["incident_count"]}))
            self.assertEqual(len(client.get("/v1/scans/coverage").json()), 2)
