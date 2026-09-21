# Incident Intelligence Contract

This document defines the first explainable duplicate-candidate slice. It is a
review aid, not an automatic incident merge and not a field-verification claim.

## Current contract

`POST /v1/incidents/duplicate-candidates` accepts:

```json
{
  "road": "Jl. Uji Integrasi",
  "latitude": -7.79,
  "longitude": 110.37,
  "radius_meters": 75,
  "exclude_incident_id": "optional",
  "road_segment_id": "optional"
}
```

The response contains candidates sorted by descending score. Every candidate
includes the incident id, distance in meters, whether the normalized road names
match, whether the road segment matches when supplied, a score from `0` to `1`,
and human-readable reasons.

The local implementation uses a great-circle distance plus normalized road-name
comparison. It intentionally does not merge records. A future PostGIS adapter
can replace the scan while preserving this response shape.

## Incident metadata

New incidents preserve:

- `request_id`: the client idempotency key used to make retries safe;
- `source`: `manual`, `ai`, or `imported`;
- `model_version`: optional model release identifier;
- `location_confidence`: optional value from `0` to `1`;
- `road_segment_id`: optional external road-network segment identifier;
- `road_match_confidence`: optional value from `0` to `1` supplied by the
  road-matching pipeline;
- `road_normalized`: stable comparison key for the entered road name.

These fields make provenance explicit before authentication, road matching, and
cloud storage are introduced.

## Next migration boundary

The current SQLite adapter stores the incident aggregate as JSON for the local
desktop MVP. Before production use, move these fields into normalized
PostgreSQL/PostGIS tables and keep the same HTTP contract. Do not implement an
automatic merge until road association, temporal proximity, visual similarity,
and review/audit behavior have been benchmarked.
