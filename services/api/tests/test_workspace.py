"""Isolated contract tests. Never touches the user's workspace database or trains a model."""
import io
import os
import sqlite3
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from fastapi.testclient import TestClient
from services.api.app.domain import haversine_meters, normalize_road_name
from services.api.app.main import app
from services.api.app.security import allowed_origins, is_loopback_host, origin_is_allowed
from services.api.app.storage import database, storage_adapter, storage_metadata


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
        self.assertEqual(response.json()["request_id"], body["request_id"])
        self.assertEqual(sum(i["id"] == item["id"] for i in self.client.get("/v1/incidents").json()), 1)

    def test_domain_normalizes_roads_and_measures_distance(self):
        self.assertEqual(normalize_road_name("  Jl. Uji   INTEGRASI "), "jl. uji integrasi")
        self.assertAlmostEqual(
            haversine_meters(-7.79, 110.37, -7.79, 110.37),
            0,
            places=6,
        )

    def test_storage_metadata_is_explicitly_local(self):
        metadata = storage_metadata()
        self.assertEqual(metadata["backend"], "sqlite")
        self.assertEqual(metadata["schema_version"], 2)
        health = self.client.get("/health").json()
        self.assertEqual(health["storage"], "SQLITE")
        self.assertEqual(health["storage_details"]["schema_version"], 2)
        readiness = self.client.get("/ready")
        self.assertEqual(readiness.status_code, 200)
        self.assertEqual(readiness.json()["status"], "ready")
        self.assertEqual(readiness.json()["manual_reporting"], True)

    def test_storage_transaction_rolls_back_failed_writes(self):
        marker = "rollback-check"
        with self.assertRaisesRegex(RuntimeError, "rollback"):
            with database() as db:
                db.execute("INSERT INTO incidents (id, payload) VALUES (?, ?)", (marker, "{}"))
                raise RuntimeError("rollback")
        with database() as db:
            self.assertIsNone(db.execute("SELECT id FROM incidents WHERE id = ?", (marker,)).fetchone())

    def test_storage_adapter_rejects_unconfigured_backend(self):
        with patch.dict(os.environ, {"RUASKITA_STORAGE_BACKEND": "postgres"}):
            with self.assertRaisesRegex(RuntimeError, "not configured in this local release"):
                storage_adapter()

    def test_storage_rejects_newer_schema_without_downgrade(self):
        with tempfile.TemporaryDirectory(prefix="ruaskita-schema-") as folder:
            path = Path(folder) / "schema.sqlite3"
            with patch.dict(os.environ, {"RUASKITA_DB": str(path)}):
                with database():
                    pass
            raw = sqlite3.connect(path)
            raw.execute("PRAGMA user_version = 999")
            raw.commit()
            raw.close()
            with patch.dict(os.environ, {"RUASKITA_DB": str(path)}):
                with self.assertRaisesRegex(RuntimeError, "newer than supported"):
                    with database():
                        pass

    def test_versioned_openapi_contract_exposes_incident_intelligence_fields(self):
        response = self.client.get("/openapi.json")
        self.assertEqual(response.status_code, 200)
        schema = response.json()
        paths = schema["paths"]
        for path in ("/v1/incidents", "/v1/incidents/duplicate-candidates", "/v1/incidents/{incident_id}/observations"):
            self.assertIn(path, paths)
        incident_fields = schema["components"]["schemas"]["IncidentInput"]["properties"]
        for field in ("request_id", "source", "model_version", "location_confidence", "road_segment_id", "road_match_confidence"):
            self.assertIn(field, incident_fields)
        candidate_fields = schema["components"]["schemas"]["DuplicateCandidateInput"]["properties"]
        self.assertIn("road_segment_id", candidate_fields)
        duplicate_response = paths["/v1/incidents/duplicate-candidates"]["post"]["responses"]["200"]
        self.assertEqual(
            duplicate_response["content"]["application/json"]["schema"]["$ref"],
            "#/components/schemas/DuplicateCandidatesResponse",
        )

    def test_local_security_boundary_is_explicit(self):
        self.assertTrue(is_loopback_host("127.0.0.1"))
        self.assertTrue(is_loopback_host("::1"))
        self.assertFalse(is_loopback_host("192.0.2.10"))
        self.assertIn("http://127.0.0.1:3000", allowed_origins())
        self.assertTrue(origin_is_allowed("http://127.0.0.1:3000"))
        self.assertFalse(origin_is_allowed("https://untrusted.example"))

    def test_unconfigured_production_storage_is_not_reported_ready(self):
        with patch.dict(os.environ, {"RUASKITA_STORAGE_BACKEND": "postgres"}):
            response = self.client.get("/ready")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["reason"], "storage_unavailable")

    def test_duplicate_candidates_are_explainable_and_scored(self):
        item, _ = self.create()
        response = self.client.post(
            "/v1/incidents/duplicate-candidates",
            json={
                "road": " jl. uji   integrasi ",
                "latitude": -7.7901,
                "longitude": 110.3701,
                "radius_meters": 100,
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["candidates"][0]["incident_id"], item["id"])
        self.assertGreater(payload["candidates"][0]["score"], 0.89)
        self.assertTrue(payload["candidates"][0]["reasons"])

    def test_duplicate_candidates_can_exclude_current_incident(self):
        item, _ = self.create()
        response = self.client.post(
            "/v1/incidents/duplicate-candidates",
            json={
                "road": item["road"],
                "latitude": item["latitude"],
                "longitude": item["longitude"],
                "exclude_incident_id": item["id"],
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(
            any(candidate["incident_id"] == item["id"] for candidate in response.json()["candidates"])
        )

    def test_incident_persists_source_and_model_metadata(self):
        _, body = self.create()
        body.update(
            request_id=str(uuid.uuid4()),
            evidence_id=self.evidence("green"),
            source="ai",
            model_version="RuasVision v0.3",
            location_confidence=0.91,
            road_segment_id="segment-uji-01",
            road_match_confidence=0.97,
        )
        response = self.client.post("/v1/incidents", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        saved = response.json()
        self.assertEqual(saved["source"], "ai")
        self.assertEqual(saved["model_version"], "RuasVision v0.3")
        self.assertEqual(saved["location_confidence"], 0.91)
        self.assertEqual(saved["road_segment_id"], "segment-uji-01")
        self.assertEqual(saved["road_match_confidence"], 0.97)

    def test_duplicate_candidates_explain_segment_match(self):
        body = {
            "request_id": str(uuid.uuid4()),
            "road": "Jl. Segment Metadata",
            "latitude": -7.81,
            "longitude": 110.39,
            "severity": "medium",
            "notes": "Segmen jalan perlu ditinjau ulang",
            "contributor": "Penguji metadata",
            "evidence_id": self.evidence("blue"),
            "road_segment_id": "segment-metadata-01",
        }
        created = self.client.post("/v1/incidents", json=body)
        self.assertEqual(created.status_code, 201, created.text)
        item = created.json()
        response = self.client.post(
            "/v1/incidents/duplicate-candidates",
            json={
                "road": body["road"],
                "latitude": body["latitude"],
                "longitude": body["longitude"],
                "radius_meters": 50,
                "road_segment_id": body["road_segment_id"],
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        candidate = next(candidate for candidate in response.json()["candidates"] if candidate["incident_id"] == item["id"])
        self.assertTrue(candidate["road_segment_match"])
        self.assertIn("Road segment sama", candidate["reasons"])

    def test_duplicate_candidates_do_not_penalize_legacy_incident_without_segment(self):
        item, _ = self.create()
        response = self.client.post(
            "/v1/incidents/duplicate-candidates",
            json={
                "road": item["road"],
                "latitude": item["latitude"],
                "longitude": item["longitude"],
                "road_segment_id": "segment-added-later",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        candidate = next(candidate for candidate in response.json()["candidates"] if candidate["incident_id"] == item["id"])
        self.assertFalse(candidate["road_segment_match"])
        self.assertEqual(candidate["score"], 1.0)

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
