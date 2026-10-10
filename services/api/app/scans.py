"""Persist camera observations, not claims of verified road condition."""
from datetime import UTC, datetime
import hashlib
import io
import json
import uuid

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import AwareDatetime, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from .domain import haversine_meters, normalize_road_name
from .operations import MAX_UPLOAD, StrictInput, now, save_incident
from .storage import database

router = APIRouter(prefix="/v1/scans")
POLICY = {"confidence": 0.5, "max_accuracy_m": 25, "max_gps_age_s": 5,
          "confirmation_frames": 2, "zone_radius_m": 20, "confirmation_window_s": 12,
          "max_frames": 3600, "min_sharpness": 40}


class StartScan(StrictInput):
    request_id: uuid.UUID
    road: str = Field(min_length=3, max_length=150)
    contributor: str = Field(min_length=2, max_length=100)


class FrameMetadata(StrictInput):
    sequence: int = Field(ge=1, le=3600)
    captured_at: AwareDatetime
    gps_at: AwareDatetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float = Field(gt=0, le=25)


def session_from(db, session_id):
    row = db.execute("SELECT payload FROM scan_sessions WHERE id=?", (session_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Sesi scan tidak ditemukan.")
    return json.loads(row[0])


def save_session(db, session):
    db.execute("UPDATE scan_sessions SET payload=? WHERE id=?", (json.dumps(session), session["id"]))


@router.post("", status_code=201)
def start_scan(body: StartScan):
    session_id = str(body.request_id)
    with database() as db:
        row = db.execute("SELECT payload FROM scan_sessions WHERE id=?", (session_id,)).fetchone()
        if row:
            session = json.loads(row[0])
            if session["road"] != body.road or session["contributor"] != body.contributor:
                raise HTTPException(409, "ID sesi sudah digunakan dengan data berbeda.")
            return session
        session = {"id": session_id, "road": body.road, "contributor": body.contributor,
                   "status": "active", "created_at": now(), "updated_at": now(),
                   "frame_count": 0, "incident_count": 0, "last_point": None, "policy": POLICY}
        db.execute("INSERT INTO scan_sessions VALUES (?,?)", (session_id, json.dumps(session)))
    return session


@router.get("")
def list_scans():
    with database() as db:
        return [json.loads(r[0]) for r in db.execute("SELECT payload FROM scan_sessions ORDER BY rowid DESC LIMIT 50")]


@router.get("/coverage")
def coverage():
    # Cap the live map payload. Full session history remains available separately.
    with database() as db:
        rows = db.execute("SELECT session_id,payload FROM scan_frames ORDER BY rowid DESC LIMIT 3000").fetchall()
    return [{"session_id": r[0], **json.loads(r[1])["point"]} for r in reversed(rows)]


@router.get("/{session_id}")
def read_scan(session_id: str):
    with database() as db:
        session = session_from(db, session_id)
        session["points"] = [json.loads(r[0])["point"] for r in db.execute(
            "SELECT payload FROM scan_frames WHERE session_id=? ORDER BY sequence", (session_id,))]
    return session


@router.post("/{session_id}/stop")
def stop_scan(session_id: str):
    with database() as db:
        session = session_from(db, session_id)
        session.update(status="stopped", updated_at=now())
        save_session(db, session)
    return session


def prepare_frame(raw):
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.width * image.height > 25_000_000:
                raise HTTPException(413, "Frame maksimal 25 megapiksel.")
            clean = ImageOps.exif_transpose(image).convert("RGB")
            clean.thumbnail((1280, 1280))
            if min(clean.size) < 160:
                raise HTTPException(422, "Frame terlalu kecil untuk live scan.")
            sharpness = float(cv2.Laplacian(cv2.cvtColor(np.asarray(clean), cv2.COLOR_RGB2GRAY), cv2.CV_64F).var())
            output = io.BytesIO()
            clean.save(output, "JPEG", quality=85)
            return output.getvalue(), sharpness
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(422, "Frame tidak valid.")


def validate_point(session, meta):
    age = (datetime.now(UTC) - meta.captured_at).total_seconds()
    if not -5 <= age <= 60:
        raise HTTPException(422, "Waktu frame kedaluwarsa. Periksa jam perangkat dan mulai ulang scan.")
    if not -1 <= (meta.captured_at - meta.gps_at).total_seconds() <= POLICY["max_gps_age_s"]:
        raise HTTPException(422, "GPS terlalu lama. Tunggu pembaruan lokasi.")
    previous = session["last_point"]
    if previous:
        seconds = (meta.captured_at - datetime.fromisoformat(previous["captured_at"])).total_seconds()
        if seconds <= 0 or meta.sequence <= previous["sequence"]:
            raise HTTPException(409, "Urutan frame tidak valid.")
        distance = haversine_meters(meta.latitude, meta.longitude, previous["latitude"], previous["longitude"])
        if distance > 50 * seconds + meta.accuracy_m + previous["accuracy_m"]:
            raise HTTPException(422, "GPS meloncat terlalu jauh. Tunggu lokasi stabil.")


def ingest_frame(session_id, meta, raw, predict):
    fingerprint = hashlib.sha256(raw + meta.model_dump_json().encode()).hexdigest()
    with database() as db:
        session = session_from(db, session_id)
        existing = db.execute("SELECT fingerprint,payload FROM scan_frames WHERE session_id=? AND sequence=?",
                              (session_id, meta.sequence)).fetchone()
        if existing:
            if existing[0] != fingerprint:
                raise HTTPException(409, "Nomor frame sudah digunakan untuk data berbeda.")
            return json.loads(existing[1])
        if session["status"] != "active":
            raise HTTPException(409, "Sesi scan sudah dihentikan.")
        validate_point(session, meta)
    clean, sharpness = prepare_frame(raw)
    # Inference occurs outside the write transaction so map reads stay responsive.
    analysis = predict(clean, POLICY["confidence"], "live-scan.jpg")
    usable = sharpness >= POLICY["min_sharpness"]
    positive = usable and bool(analysis["potholes"])
    state = "detected" if positive else "no_detection" if usable else "uncertain"
    point = {**meta.model_dump(mode="json"), "state": state, "incident_id": None,
             "sharpness": round(sharpness, 2), "detections": len(analysis["potholes"])}
    with database() as db:
        session = session_from(db, session_id)
        existing = db.execute("SELECT fingerprint,payload FROM scan_frames WHERE session_id=? AND sequence=?",
                              (session_id, meta.sequence)).fetchone()
        if existing:
            if existing[0] != fingerprint:
                raise HTTPException(409, "Nomor frame sudah digunakan untuk data berbeda.")
            return json.loads(existing[1])
        if session["status"] != "active":
            raise HTTPException(409, "Sesi scan sudah dihentikan.")
        validate_point(session, meta)
        previous = session["last_point"]
        close = previous and haversine_meters(meta.latitude, meta.longitude, previous["latitude"], previous["longitude"]) <= POLICY["zone_radius_m"]
        recent = previous and (meta.captured_at - datetime.fromisoformat(previous["captured_at"])).total_seconds() <= POLICY["confirmation_window_s"]
        confirmed = positive and close and recent and previous["state"] == "detected"
        incident = None
        if confirmed:
            # A spatial candidate zone, never an assertion that these are the same physical pothole.
            if previous.get("incident_id"):
                candidate = json.loads(db.execute("SELECT payload FROM incidents WHERE id=?", (previous["incident_id"],)).fetchone()[0])
                if (candidate["status"] == "candidate" and
                    haversine_meters(meta.latitude, meta.longitude, candidate["latitude"], candidate["longitude"]) <= POLICY["zone_radius_m"]):
                    incident = candidate
            if incident is None:
                # Bridge a brief missed detection within this session only. Do not merge other users' incidents.
                for row in db.execute("SELECT payload FROM incidents ORDER BY rowid DESC"):
                    candidate = json.loads(row[0])
                    if candidate.get("scan_session_id") != session_id or candidate["status"] != "candidate":
                        continue
                    if (haversine_meters(meta.latitude, meta.longitude, candidate["latitude"], candidate["longitude"]) <= POLICY["zone_radius_m"]
                        and (meta.captured_at - datetime.fromisoformat(candidate["observations"][0]["recorded_at"])).total_seconds() <= 60):
                        incident = candidate
                        break
            if incident is None:
                stamp = now()
                incident_id = "RK-" + str(uuid.uuid5(uuid.UUID(session_id), str(meta.sequence)))
                evidence_id = "EV-" + str(uuid.uuid4())
                db.execute("INSERT INTO evidence VALUES (?,?,?,?)", (evidence_id, clean, json.dumps(analysis), stamp))
                note = "Kandidat area temuan dari dua frame berurutan. Posisi GPS perangkat, bukan koordinat lubang terukur. Tingkat perhatian sementara; perlu tinjauan."
                incident = {"id": incident_id, "road": session["road"], "road_normalized": normalize_road_name(session["road"]),
                            "latitude": meta.latitude, "longitude": meta.longitude, "severity": "medium", "status": "candidate",
                            "assignee": "", "notes": note, "contributor": session["contributor"], "source": "ai",
                            "model_version": analysis["model_version"], "scan_session_id": session_id,
                            "gps_accuracy_m": meta.accuracy_m, "gps_at": meta.gps_at.isoformat(),
                            "location_confidence": None, "created_at": stamp, "updated_at": stamp, "revision": 1,
                            "observations": [{"evidence_id": evidence_id, "analysis": analysis, "created_at": stamp,
                                              "recorded_at": meta.captured_at.isoformat(), "contributor": session["contributor"],
                                              "notes": note, "kind": "initial", "source": "ai", "model_version": analysis["model_version"]}],
                            "history": [{"status": "candidate", "note": note, "at": stamp}]}
                save_incident(db, incident)
                session["incident_count"] += 1
            point["incident_id"] = incident["id"]
        session["frame_count"] += 1
        session.update(last_point=point, updated_at=now())
        result = {"point": point, "analysis": analysis, "incident_id": point["incident_id"],
                  "frame_count": session["frame_count"], "incident_count": session["incident_count"]}
        db.execute("INSERT INTO scan_frames VALUES (?,?,?,?)", (session_id, meta.sequence, fingerprint, json.dumps(result)))
        save_session(db, session)
    return result


@router.post("/{session_id}/frames")
async def scan_frame(session_id: str, request: Request, image: UploadFile = File(...), metadata: str = Form(...)):
    try:
        meta = FrameMetadata.model_validate_json(metadata)
    except ValidationError:
        raise HTTPException(422, "GPS/frame tidak valid. Akurasi GPS harus paling jauh ±25 m.")
    raw = await image.read(MAX_UPLOAD + 1)
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "Frame maksimal 10 MB.")
    return await run_in_threadpool(ingest_frame, session_id, meta, raw, request.app.state.scan_predict)
