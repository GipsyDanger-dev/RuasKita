"""FastAPI adapter for the frozen RuasVision offline release."""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import yaml
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO


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
    if not checkpoint.exists():
        raise RuntimeError(f"Frozen RuasVision checkpoint is missing: {checkpoint}")
    app.state.manifest = manifest
    app.state.model = YOLO(str(checkpoint))
    yield


app = FastAPI(
    title="RuasKita API",
    version="0.1.0",
    description="Desktop MVP API backed by the frozen RuasVision offline release.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    manifest = app.state.manifest
    return {"status": "ok", "engine": manifest["release"], "model_loaded": True}


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
    encoded = np.frombuffer(await image.read(), dtype=np.uint8)
    frame = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=422, detail="The uploaded file is not a decodable image.")

    result = app.state.model.predict(source=frame, conf=confidence, imgsz=640, device=0, verbose=False)[0]
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
        "image": image.filename or "upload",
        "image_shape": {"height": int(result.orig_shape[0]), "width": int(result.orig_shape[1])},
        "confidence_threshold": confidence,
        "potholes": potholes,
        "depth_policy": DEPTH_POLICY,
    }
