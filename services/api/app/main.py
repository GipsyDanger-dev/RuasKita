"""FastAPI adapter for the frozen RuasVision offline release."""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
import os
import threading
import io
from PIL import Image, UnidentifiedImageError

import cv2
import numpy as np
import yaml
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
os.environ.setdefault("YOLO_AUTOINSTALL", "false")
from ultralytics import YOLO
from fastapi.responses import JSONResponse
from .operations import router, database, MAX_UPLOAD


PROJECT_ROOT = Path(__file__).resolve().parents[3]
RELEASE_PATH = PROJECT_ROOT / "ai_engine" / "config" / "ruasvision-release-v0.3.yaml"
DEPTH_POLICY = "No centimetre depth is emitted; RuasDepth v0.1 uses relative transformed disparity only."


def release_manifest() -> dict[str, Any]:
    manifest = yaml.safe_load(RELEASE_PATH.read_text(encoding="utf-8"))
    if manifest.get("status") != "frozen-offline-release":
        raise RuntimeError("RuasVision release manifest is not frozen.")
    return manifest


@asynccontextmanager
async def lifespan(app: FastAPI):
    manifest = release_manifest()
    checkpoint = PROJECT_ROOT / str(manifest["checkpoint"])
    app.state.manifest = manifest
    app.state.model = YOLO(str(checkpoint)) if checkpoint.exists() and os.getenv("RUASKITA_DISABLE_MODEL") != "1" else None
    app.state.inference_lock = threading.Lock()
    yield


app = FastAPI(
    title="RuasKita API",
    version="0.1.0",
    description="Desktop MVP API backed by the frozen RuasVision offline release.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("RUASKITA_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.include_router(router)


@app.middleware("http")
async def local_workspace_only(request, call_next):
    # No fake authentication: until Supabase/RBAC lands this is loopback-only.
    if request.client and request.client.host not in {"127.0.0.1", "::1", "testclient"}:
        return JSONResponse({"detail": "Workspace lokal. Akses jaringan dinonaktifkan sampai autentikasi tersedia."}, status_code=403)
    origin = request.headers.get("origin")
    allowed = os.getenv("RUASKITA_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if request.method not in {"GET", "HEAD", "OPTIONS"} and origin and origin not in allowed:
        return JSONResponse({"detail": "Origin tidak diizinkan."}, status_code=403)
    return await call_next(request)


@app.get("/health")
def health() -> dict[str, Any]:
    manifest = app.state.manifest
    return {"status": "ok", "engine": manifest["release"], "model_loaded": app.state.model is not None,
            "mode": "local", "storage": "SQLite", "authentication": "not_configured"}


@app.get("/v1/model")
def model_metadata() -> dict[str, Any]:
    manifest = app.state.manifest
    return {
        "engine": manifest["release"],
        "status": manifest["status"],
        "checkpoint": manifest["checkpoint"],
        "checkpoint_sha256": manifest["checkpoint_sha256"],
        "test_metrics": manifest["test_metrics"],
        "operating_point": manifest["operating_point"],
        "depth_policy": DEPTH_POLICY,
    }


@app.post("/v1/inference/image")
async def infer_image(
    image: UploadFile = File(...),
    confidence: float = Query(default=0.50, ge=0.0, le=1.0),
) -> dict[str, Any]:
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Upload must be an image.")
    raw = await image.read(MAX_UPLOAD + 1)
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "Foto maksimal 10 MB.")
    return predict(raw, confidence, image.filename or "upload")


def predict(raw: bytes, confidence: float = .5, filename: str = "evidence"):
    if app.state.model is None:
        raise HTTPException(503, "Checkpoint AI belum tersedia. Laporan manual tetap dapat disimpan.")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.width * source.height > 25_000_000:
                raise HTTPException(413, "Foto maksimal 25 megapiksel.")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(422, "Foto tidak valid atau rusak.")
    encoded = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=422, detail="The uploaded file is not a decodable image.")

    import torch
    with app.state.inference_lock:
        result = app.state.model.predict(source=frame, conf=confidence, imgsz=640, device=0 if torch.cuda.is_available() else "cpu", verbose=False)[0]
    masks = result.masks.xy if result.masks is not None else []
    boxes = result.boxes
    potholes = [
        {
            "class": "pothole",
            "confidence": float(boxes.conf[index]),
            "bbox_xyxy": [float(value) for value in boxes.xyxy[index].tolist()],
            "polygon_xy": [[float(x), float(y)] for x, y in polygon.tolist()],
        }
        for index, polygon in enumerate(masks)
    ]
    manifest = app.state.manifest
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "engine": manifest["release"],
        "model": manifest["checkpoint"],
        "model_version": manifest["release"],
        "image": filename,
        "image_shape": {"height": int(result.orig_shape[0]), "width": int(result.orig_shape[1])},
        "confidence_threshold": confidence,
        "potholes": potholes,
        "depth_policy": DEPTH_POLICY,
    }


@app.post("/v1/evidence/{evidence_id}/analyze")
def analyze_evidence(evidence_id: str):
    import json
    with database() as db:
        row = db.execute("SELECT image FROM evidence WHERE id = ?", (evidence_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Foto tidak ditemukan.")
    result = predict(row[0])
    with database() as db:
        db.execute("UPDATE evidence SET analysis = ? WHERE id = ?", (json.dumps(result), evidence_id))
    return result
