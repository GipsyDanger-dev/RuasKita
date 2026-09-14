"""Isolated contract tests. Never touches the user's workspace database or trains a model."""
import io
import os
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from fastapi.testclient import TestClient
from services.api.app.main import app


class WorkspaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory(prefix="ruaskita-tests-")
        cls.env = patch.dict(os.environ, {"RUASKITA_DB": str(Path(cls.folder.name) / "test.sqlite3"), "RUASKITA_DISABLE_MODEL": "1"})
        cls.env.start()
        cls.context = TestClient(app)
        cls.client = cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)
        cls.env.stop()
        cls.folder.cleanup()

    def evidence(self, color="gray"):
        output = io.BytesIO()
        Image.new("RGB", (100, 80), color).save(output, "PNG")
        response = self.client.post("/v1/evidence", files={"image": ("road.png", output.getvalue(), "image/png")})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["id"]

    def create(self):
        body = {"request_id": str(uuid.uuid4()), "road": "Jl. Uji Integrasi", "latitude": -7.79, "longitude": 110.37,
                "severity": "high", "notes": "Lubang terlihat pada permukaan jalan", "contributor": "Penguji lokal", "evidence_id": self.evidence()}
        response = self.client.post("/v1/incidents", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json(), body

    def transition(self, item, status, **extra):
        return self.client.post(f'/v1/incidents/{item["id"]}/transition', json={"revision": item["revision"], "status": status, "note": "Tindakan pengujian lokal", **extra})

    def test_full_repair_lifecycle_and_history(self):
        item, _ = self.create()
        for stage in ["verified", "assigned", "in_repair", "recheck", "resolved", "candidate"]:
            extra = {"assignee": "Tim A"} if stage == "assigned" else {"evidence_id": self.evidence("green")} if stage == "recheck" else {}
            response = self.transition(item, stage, **extra)
            self.assertEqual(response.status_code, 200, response.text)
            item = response.json()
        self.assertEqual(len(item["history"]), 7)
        self.assertEqual(len(item["observations"]), 2)
        self.assertEqual(item["revision"], 7)
        self.assertEqual(self.client.get(f'/v1/incidents/{item["id"]}').json(), item)

    def test_cannot_skip_lifecycle(self):
        item, _ = self.create()
        self.assertEqual(self.transition(item, "resolved").status_code, 422)

    def test_revision_conflict(self):
        item, _ = self.create()
        self.assertEqual(self.transition(item, "verified").status_code, 200)
        self.assertEqual(self.transition(item, "verified").status_code, 409)

    def test_assignment_required(self):
        item, _ = self.create()
        item = self.transition(item, "verified").json()
        self.assertEqual(self.transition(item, "assigned").status_code, 422)

    def test_repair_requires_new_evidence(self):
        item, _ = self.create()
        for stage, extra in [("verified", {}), ("assigned", {"assignee": "Tim A"}), ("in_repair", {})]:
            item = self.transition(item, stage, **extra).json()
        self.assertEqual(self.transition(item, "recheck").status_code, 422)
        self.assertEqual(self.transition(item, "recheck", evidence_id=item["observations"][0]["evidence_id"]).status_code, 422)

    def test_create_retry_does_not_duplicate(self):
        item, body = self.create()
        response = self.client.post("/v1/incidents", json=body)
        self.assertEqual(response.json()["id"], item["id"])
        self.assertEqual(sum(i["id"] == item["id"] for i in self.client.get("/v1/incidents").json()), 1)

    def test_observation_stays_in_one_incident(self):
        item, _ = self.create()
        body = {"revision": item["revision"], "evidence_id": self.evidence(), "notes": "Foto observasi tambahan", "contributor": "Penguji kedua"}
        response = self.client.post(f'/v1/incidents/{item["id"]}/observations', json=body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["observations"]), 2)

    def test_report_snapshot_is_immutable(self):
        item, _ = self.create()
        response = self.client.post("/v1/reports", json={"title": "Laporan uji", "road": item["road"], "start": "2020-01-01", "end": "2099-12-31"})
        self.assertEqual(response.status_code, 201, response.text)
        report = response.json()
        self.transition(item, "verified")
        saved = self.client.get(f'/v1/reports/{report["id"]}').json()
        self.assertTrue(saved["integrity_valid"])
        self.assertEqual(saved["sha256"], report["sha256"])
        self.assertEqual(next(i for i in saved["snapshot"]["incidents"] if i["id"] == item["id"])["status"], "candidate")

    def test_bad_report_dates(self):
        self.assertEqual(self.client.post("/v1/reports", json={"title": "Invalid dates", "start": "2026-10-01", "end": "2026-01-01"}).status_code, 422)

    def test_empty_report_rejected(self):
        self.assertEqual(self.client.post("/v1/reports", json={"title": "No data", "road": str(uuid.uuid4()), "start": "2020-01-01", "end": "2099-01-01"}).status_code, 422)

    def test_invalid_image_rejected(self):
        self.assertEqual(self.client.post("/v1/evidence", files={"image": ("fake.jpg", b"not image", "image/jpeg")}).status_code, 422)

    def test_oversize_image_rejected(self):
        self.assertEqual(self.client.post("/v1/evidence", files={"image": ("huge.jpg", b"x" * (10 * 1024 * 1024 + 1), "image/jpeg")}).status_code, 413)

    def test_evidence_is_sanitized_jpeg(self):
        response = self.client.get(f'/v1/evidence/{self.evidence()}')
        self.assertEqual(response.headers["content-type"], "image/jpeg")
        with Image.open(io.BytesIO(response.content)) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertFalse(image.getexif())

    def test_missing_evidence_rejected(self):
        _, body = self.create()
        body.update(request_id=str(uuid.uuid4()), evidence_id="missing")
        self.assertEqual(self.client.post("/v1/incidents", json=body).status_code, 422)

    def test_invalid_coordinate_rejected(self):
        _, body = self.create()
        body.update(request_id=str(uuid.uuid4()), latitude=200)
        self.assertEqual(self.client.post("/v1/incidents", json=body).status_code, 422)

    def test_unknown_routes_return_404(self):
        for path in ["incidents", "evidence", "reports"]:
            self.assertEqual(self.client.get(f"/v1/{path}/missing").status_code, 404)

    def test_model_unavailable_does_not_break_manual_reporting(self):
        self.assertFalse(self.client.get("/health").json()["model_loaded"])
        self.assertEqual(self.client.post(f'/v1/evidence/{self.evidence()}/analyze').status_code, 503)
        self.create()

    def test_untrusted_origin_cannot_write(self):
        self.assertEqual(self.client.post("/v1/incidents", headers={"Origin": "https://untrusted.example"}, json={}).status_code, 403)


if __name__ == "__main__":
    unittest.main()
