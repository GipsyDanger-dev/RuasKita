"""Regression checks for the PostgreSQL/PostGIS migration boundary."""

from pathlib import Path
import unittest


MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "001_incident_intelligence.sql"


class MigrationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8").upper()

    def test_migration_enables_spatial_incident_queries(self):
        self.assertIn("CREATE EXTENSION IF NOT EXISTS POSTGIS", self.sql)
        self.assertIn("LOCATION GEOGRAPHY(POINT, 4326)", self.sql)
        self.assertIn("INCIDENTS_LOCATION_GIX", self.sql)
        self.assertIn("USING GIST (LOCATION)", self.sql)

    def test_migration_preserves_incident_intelligence_entities(self):
        for table in ("INCIDENTS", "EVIDENCE", "OBSERVATIONS", "INCIDENT_HISTORY", "REPORTS"):
            self.assertIn(f"CREATE TABLE IF NOT EXISTS {table}", self.sql)
        for field in (
            "ROAD_NORMALIZED",
            "ROAD_SEGMENT_ID",
            "LOCATION_CONFIDENCE",
            "ROAD_MATCH_CONFIDENCE",
            "MODEL_VERSION",
        ):
            self.assertIn(field, self.sql)

    def test_migration_keeps_retry_and_observation_invariants(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS INCIDENT_IDEMPOTENCY", self.sql)
        self.assertIn("REQUEST_ID UUID PRIMARY KEY", self.sql)
        self.assertIn("UNIQUE (INCIDENT_ID, EVIDENCE_ID)", self.sql)
        self.assertIn("ON DELETE CASCADE", self.sql)


if __name__ == "__main__":
    unittest.main()
