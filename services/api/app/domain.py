"""Pure domain helpers for incident intelligence.

The first implementation is deliberately database-agnostic.  It can run with
the local SQLite adapter and later be replaced by PostGIS queries without
changing the incident API contract.
"""

from __future__ import annotations

import math
import unicodedata
from typing import Any

EARTH_RADIUS_METERS = 6_371_008.8


def normalize_road_name(value: str) -> str:
    """Return a stable comparison key for a human-entered road name."""

    folded = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(folded.split())


def haversine_meters(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    """Return the great-circle distance between two WGS84 coordinates."""

    lat_a = math.radians(latitude_a)
    lat_b = math.radians(latitude_b)
    delta_lat = math.radians(latitude_b - latitude_a)
    delta_lon = math.radians(longitude_b - longitude_a)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    )
    return EARTH_RADIUS_METERS * 2 * math.asin(math.sqrt(haversine))


def duplicate_candidate(
    existing: dict[str, Any],
    *,
    road: str,
    latitude: float,
    longitude: float,
    radius_meters: float = 75.0,
    road_segment_id: str | None = None,
) -> dict[str, Any] | None:
    """Score an existing incident as a possible duplicate.

    This is a review aid, not an automatic merge.  A same-road match and a
    close coordinate are intentionally explainable inputs to the score.
    """

    distance = haversine_meters(
        latitude,
        longitude,
        float(existing["latitude"]),
        float(existing["longitude"]),
    )
    if distance > radius_meters:
        return None

    existing_road_key = existing.get("road_normalized") or normalize_road_name(
        str(existing.get("road", ""))
    )
    road_match = normalize_road_name(road) == existing_road_key
    segment_match = bool(road_segment_id and existing.get("road_segment_id") == road_segment_id)
    distance_score = max(0.0, 1.0 - distance / radius_meters)
    if road_segment_id:
        score = 0.5 * distance_score + (0.25 if road_match else 0.0) + (0.25 if segment_match else 0.0)
    else:
        score = 0.65 * distance_score + (0.35 if road_match else 0.0)
    reasons: list[str] = []
    if road_match:
        reasons.append("Nama ruas sama")
    if segment_match:
        reasons.append("Road segment sama")
    if distance <= 25:
        reasons.append("Koordinat sangat berdekatan")
    else:
        reasons.append("Koordinat berada dalam radius tinjauan")
    if existing.get("status") == "resolved":
        reasons.append("Insiden lama sudah selesai dan perlu tinjauan manual")

    return {
        "incident_id": existing["id"],
        "score": round(score, 4),
        "distance_meters": round(distance, 2),
        "road_match": road_match,
        "road_segment_match": segment_match,
        "reasons": reasons,
        "status": existing.get("status"),
        "severity": existing.get("severity"),
    }
