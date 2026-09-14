# RuasKita API

FastAPI adapter for the frozen RuasVision release and persistent local desktop
workspace. Includes image evidence, incidents/observations, guarded repair
transitions and immutable report snapshots.

```powershell
.\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --reload --port 8000
```

Open `http://127.0.0.1:8000/docs` for the API explorer. The API reads
`ai_engine/config/ruasvision-release-v0.3.yaml`; the manifest must be frozen.
If its checkpoint is missing, manual workflows stay available and analysis returns
503. Set `RUASKITA_DISABLE_MODEL=1` only for model-free integration tests.

See [desktop workspace documentation](../../docs/DESKTOP_WORKSPACE.md) for the
database, contracts, tests and local-only security limitations.
