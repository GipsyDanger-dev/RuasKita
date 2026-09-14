# RuasKita API

FastAPI adapter for the frozen RuasVision offline release. It is intentionally
small for the desktop MVP: it accepts one road image and returns the stable
segmentation JSON contract.

```powershell
.\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --reload --port 8000
```

Open `http://127.0.0.1:8000/docs` for the API explorer. The API reads
`ai_engine/config/ruasvision-release-v0.3.yaml`; it refuses to start unless
that manifest is frozen and its checkpoint is present.
