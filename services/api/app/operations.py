"""Local desktop workspace. SQLite is deliberately not a production auth/storage substitute."""
from __future__ import annotations

import hashlib
import io
import json
import uuid
from datetime import UTC, date, datetime
from typing import Literal

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field

from .domain import duplicate_candidate, normalize_road_name
from .storage import database

router = APIRouter(prefix="/v1")
MAX_UPLOAD = 10 * 1024 * 1024
Status = Literal["candidate", "verified", "assigned", "in_repair", "recheck", "resolved"]
Severity = Literal["low", "medium", "high"]
TRANSITIONS = {
    "candidate": ["verified"], "verified": ["assigned"],
    "assigned": ["in_repair"], "in_repair": ["recheck"],
    "recheck": ["resolved", "in_repair"], "resolved": ["candidate"],
}
Source = Literal["manual", "ai", "imported"]


def now():
    return datetime.now(UTC).isoformat()


def get_incident(db, incident_id):
    row = db.execute("SELECT payload FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Insiden tidak ditemukan.")
    return json.loads(row[0])


def save_incident(db, item):
    db.execute("INSERT OR REPLACE INTO incidents VALUES (?, ?)", (item["id"], json.dumps(item)))


def require_evidence(db, evidence_id):
    row = db.execute("SELECT analysis, created_at FROM evidence WHERE id = ?", (evidence_id,)).fetchone()
    if not row:
        raise HTTPException(422, "Bukti foto tidak ditemukan. Unggah ulang foto.")
    return {"evidence_id": evidence_id, "analysis": json.loads(row[0]) if row[0] else None, "created_at": row[1]}


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class IncidentInput(StrictInput):
    request_id: uuid.UUID
    road: str = Field(min_length=3, max_length=150)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    severity: Severity
    notes: str = Field(min_length=5, max_length=3000)
    contributor: str = Field(min_length=2, max_length=100)
    evidence_id: str
    source: Source = "manual"
    model_version: str | None = Field(default=None, max_length=100)
    location_confidence: float | None = Field(default=None, ge=0, le=1)
    road_segment_id: str | None = Field(default=None, max_length=100)
    road_match_confidence: float | None = Field(default=None, ge=0, le=1)


class TransitionInput(StrictInput):
    revision: int = Field(ge=1)
    status: Status
    note: str = Field(min_length=5, max_length=3000)
    assignee: str = Field(default="", max_length=100)
    evidence_id: str | None = None


class ObservationInput(StrictInput):
    revision: int = Field(ge=1)
    evidence_id: str
    notes: str = Field(min_length=5, max_length=3000)
    contributor: str = Field(min_length=2, max_length=100)
    source: Source = "manual"
    model_version: str | None = Field(default=None, max_length=100)


class DuplicateCandidateInput(StrictInput):
    road: str = Field(min_length=3, max_length=150)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_meters: float = Field(default=75, ge=10, le=1000)
    exclude_incident_id: str | None = Field(default=None, max_length=100)
    road_segment_id: str | None = Field(default=None, max_length=100)


class DuplicateCandidate(StrictInput):
    incident_id: str
    score: float = Field(ge=0, le=1)
    distance_meters: float = Field(ge=0)
    road_match: bool
    road_segment_match: bool
    reasons: list[str]
    status: Status | None = None
    severity: Severity | None = None


class DuplicateCandidatesResponse(StrictInput):
    radius_meters: float = Field(ge=10, le=1000)
    candidates: list[DuplicateCandidate]


@router.post("/evidence", status_code=201)
async def upload_evidence(image: UploadFile = File(...)):
    raw = await image.read(MAX_UPLOAD + 1)
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "Foto maksimal 10 MB.")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(415, "Gunakan JPEG, PNG, atau WebP.")
            if source.width * source.height > 25_000_000:
                raise HTTPException(413, "Foto maksimal 25 megapiksel.")
            clean = ImageOps.exif_transpose(source).convert("RGB")
            clean.thumbnail((2400, 2400))
            output = io.BytesIO()
            clean.save(output, "JPEG", quality=90)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(422, "Foto tidak valid atau rusak.")
    evidence_id = str(uuid.uuid4())
    with database() as db:
        db.execute("INSERT INTO evidence VALUES (?, ?, NULL, ?)", (evidence_id, output.getvalue(), now()))
    return {"id": evidence_id, "url": f"/v1/evidence/{evidence_id}", "width": clean.width, "height": clean.height}


@router.get("/evidence/{evidence_id}")
def evidence_image(evidence_id: str):
    with database() as db:
        row = db.execute("SELECT image FROM evidence WHERE id = ?", (evidence_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Foto tidak ditemukan.")
    return Response(row[0], media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"})


@router.get("/incidents")
def list_incidents():
    with database() as db:
        return [json.loads(row[0]) for row in db.execute("SELECT payload FROM incidents ORDER BY rowid DESC")]


@router.post("/incidents/duplicate-candidates", response_model=DuplicateCandidatesResponse)
def list_duplicate_candidates(body: DuplicateCandidateInput):
    with database() as db:
        incidents = [
            json.loads(row[0])
            for row in db.execute("SELECT payload FROM incidents ORDER BY rowid DESC")
        ]
    candidates = [
        candidate
        for incident in incidents
        if incident["id"] != body.exclude_incident_id
        for candidate in [
            duplicate_candidate(
                incident,
                road=body.road,
                latitude=body.latitude,
                longitude=body.longitude,
                radius_meters=body.radius_meters,
                road_segment_id=body.road_segment_id,
            )
        ]
        if candidate is not None
    ]
    candidates.sort(key=lambda item: item["score"], reverse=True)
    return {"radius_meters": body.radius_meters, "candidates": candidates}


@router.post("/incidents", status_code=201)
def create_incident(body: IncidentInput):
    request_id = str(body.request_id)
    incident_id = "RK-" + request_id
    with database() as db:
        key = db.execute(
            "SELECT incident_id FROM incident_idempotency WHERE request_id = ?",
            (request_id,),
        ).fetchone()
        if key:
            return get_incident(db, key[0])
        existing = db.execute("SELECT payload FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        if existing:
            db.execute(
                "INSERT OR IGNORE INTO incident_idempotency (request_id, incident_id) VALUES (?, ?)",
                (request_id, incident_id),
            )
            return json.loads(existing[0])
        observation = require_evidence(db, body.evidence_id)
        stamp = now()
        observation.update(
            notes=body.notes,
            contributor=body.contributor,
            kind="initial",
            recorded_at=stamp,
            source=body.source,
            model_version=body.model_version,
        )
        item = {"id": incident_id, "request_id": str(body.request_id), "road": body.road, "latitude": body.latitude, "longitude": body.longitude,
                "severity": body.severity, "notes": body.notes, "contributor": body.contributor,
                "road_normalized": normalize_road_name(body.road),
                "source": body.source, "model_version": body.model_version,
                "location_confidence": body.location_confidence,
                "road_segment_id": body.road_segment_id,
                "road_match_confidence": body.road_match_confidence,
                "status": "candidate", "assignee": "", "created_at": stamp, "updated_at": stamp,
                "revision": 1, "observations": [observation],
                "history": [{"status": "candidate", "note": body.notes, "at": stamp}]}
        save_incident(db, item)
        db.execute(
            "INSERT INTO incident_idempotency (request_id, incident_id) VALUES (?, ?)",
            (request_id, incident_id),
        )
    return item


@router.get("/incidents/{incident_id}")
def read_incident(incident_id: str):
    with database() as db:
        return get_incident(db, incident_id)


@router.post("/incidents/{incident_id}/transition")
def transition_incident(incident_id: str, body: TransitionInput):
    with database() as db:
        item = get_incident(db, incident_id)
        if item["revision"] != body.revision:
            raise HTTPException(409, "Data berubah. Muat ulang sebelum melanjutkan.")
        if body.status not in TRANSITIONS[item["status"]]:
            raise HTTPException(422, "Urutan status tidak valid.")
        if body.status == "assigned" and len(body.assignee.strip()) < 2:
            raise HTTPException(422, "Penanggung jawab wajib diisi.")
        if body.status == "recheck":
            if not body.evidence_id or body.evidence_id in [o["evidence_id"] for o in item["observations"]]:
                raise HTTPException(422, "Unggah bukti baru setelah perbaikan.")
            observation = require_evidence(db, body.evidence_id)
            observation.update(
                notes=body.note,
                contributor=item["assignee"],
                kind="repair",
                recorded_at=now(),
                source="manual",
            )
            item["observations"].append(observation)
        item.update(status=body.status, updated_at=now(), revision=item["revision"] + 1)
        if body.status == "assigned":
            item["assignee"] = body.assignee
        item["history"].append({"status": body.status, "note": body.note, "at": item["updated_at"]})
        save_incident(db, item)
    return item


@router.post("/incidents/{incident_id}/observations")
def add_observation(incident_id: str, body: ObservationInput):
    with database() as db:
        item = get_incident(db, incident_id)
        if item["revision"] != body.revision:
            raise HTTPException(409, "Data berubah. Muat ulang sebelum melanjutkan.")
        if body.evidence_id in [o["evidence_id"] for o in item["observations"]]:
            raise HTTPException(422, "Bukti ini sudah ada pada insiden.")
        observation = require_evidence(db, body.evidence_id)
        observation.update(
            notes=body.notes,
            contributor=body.contributor,
            kind="observation",
            recorded_at=now(),
            source=body.source,
            model_version=body.model_version,
        )
        item["observations"].append(observation)
        item.update(updated_at=now(), revision=item["revision"] + 1)
        item["history"].append({"status": item["status"], "note": f"Observasi tambahan: {body.notes}", "at": item["updated_at"]})
        save_incident(db, item)
    return item


class ReportInput(StrictInput):
    title: str = Field(min_length=3, max_length=150)
    road: str = Field(default="", max_length=150)
    start: date
    end: date


def digest(snapshot):
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


@router.get("/reports")
def list_reports():
    with database() as db:
        return [json.loads(row[0]) for row in db.execute("SELECT payload FROM reports ORDER BY rowid DESC")]


@router.post("/reports", status_code=201)
def create_report(body: ReportInput):
    if body.start > body.end:
        raise HTTPException(422, "Tanggal akhir harus setelah tanggal awal.")
    with database() as db:
        items = [json.loads(row[0]) for row in db.execute("SELECT payload FROM incidents")]
        items = [i for i in items if (not body.road or i["road"] == body.road) and str(body.start) <= i["created_at"][:10] <= str(body.end)]
        if not items:
            raise HTTPException(422, "Tidak ada insiden dalam filter laporan.")
        snapshot = {"title": body.title, "road": body.road, "start": str(body.start), "end": str(body.end), "generated_at": now(), "incidents": items,
                    "policy": "Draf internal lokal, bukan laporan terverifikasi lapangan. Kedalaman metrik tidak tersedia. Hash memverifikasi snapshot JSON, bukan berkas PDF."}
        result = {"id": "REP-" + str(uuid.uuid4()), "snapshot": snapshot, "sha256": digest(snapshot)}
        db.execute("INSERT INTO reports VALUES (?, ?)", (result["id"], json.dumps(result)))
    return result


@router.get("/reports/{report_id}")
def read_report(report_id: str):
    with database() as db:
        row = db.execute("SELECT payload FROM reports WHERE id = ?", (report_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Laporan tidak ditemukan.")
    result = json.loads(row[0])
    return {**result, "integrity_valid": digest(result["snapshot"]) == result["sha256"]}
