# RuasKita AI Engine

`RuasVision v0.3` detects and segments potholes. `RuasDepth v0.1` is a
depth-aware research pipeline: it produces relative-depth evidence only until
it is calibrated with metric RGB-D captures.

## Dataset policy

- Raw files in `Dataset/` are immutable inputs.
- Generated, normalized datasets live in `ai_engine/data/processed/`.
- Dataset4 classes (`POTHOLE`, `Pothole`, `object`, `pothole`) are normalized
  to one class: `pothole`.
- Dataset1 `normal/` images are included as empty-mask hard negatives; its
  classification-only pothole images are excluded because they lack masks.
- Exact duplicate images are assigned to one canonical sample before any split
  is made. The resulting manifest records every retained source and split.
- Dataset3 (Pothole-600) is retained as an RGB + transformed-disparity + mask
  research dataset. Its transformed disparity is *not* centimetre-grade depth.

## Setup

Use Python 3.11; the system Python 3.14 is not supported by the current
NumPy/OpenCV stack in this workspace.

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ai_engine\requirements.txt
python -m pip install -r ai_engine\requirements-gpu.txt
```

The second command installs the official CUDA build on the NVIDIA training
machine. Confirm `torch.cuda.is_available()` before training.

## Build the segmentation dataset

```powershell
python ai_engine\scripts\prepare_segmentation_dataset.py
```

The command creates the v0.3 YOLO segmentation dataset and an immutable
manifest in `ai_engine/data/processed/ruaskita-seg-v0.3/`.

## Train the baseline

```powershell
python ai_engine\scripts\train_segmentation.py --epochs 100 --patience 20 --imgsz 640
```

`--epochs` is an upper bound. Training stops early after `--patience` consecutive
validation epochs without improvement, so the chosen checkpoint is based on
validation performance rather than a fixed epoch count.

The final YOLO11n-versus-YOLO11s release comparison must follow
[`config/finalization-protocol-v0.3.yaml`](config/finalization-protocol-v0.3.yaml),
including its fixed split, seed, evaluation commands, and release gate. A
continued incumbent checkpoint may demonstrate plateau behaviour, but the
architecture decision itself uses two fresh, official-pretrained candidates so
one architecture does not receive extra prior fine-tuning.
After both candidates have their test, image-presence, and hard-negative
reports, verify that evidence with:

```powershell
python ai_engine\scripts\verify_finalization.py
```

The validator intentionally fails while any required report is absent; it does
not permit releasing a candidate from training metrics alone.

Run each comparison candidate separately, then run all three evaluations before
starting the next GPU job:

```powershell
# Fresh YOLO11n comparison candidate
python ai_engine\scripts\train_segmentation.py --model yolo11n-seg.pt --epochs 100 --patience 20 --imgsz 640 --device 0 --workers 0 --name yolo11n-seg-v0.3-comparison --exist-ok

# Fresh YOLO11s comparison candidate
python ai_engine\scripts\train_segmentation.py --model yolo11s-seg.pt --epochs 100 --patience 20 --imgsz 640 --device 0 --workers 0 --name yolo11s-seg-v0.3-comparison

# Replace <run> with either comparison run name after its training finishes.
python ai_engine\scripts\evaluate_segmentation.py --weights ai_engine\runs\<run>\weights\best.pt --imgsz 640 --device 0
python ai_engine\scripts\evaluate_image_presence.py --weights ai_engine\runs\<run>\weights\best.pt --confidence 0.50 --imgsz 640 --device 0
python ai_engine\scripts\evaluate_hard_negatives.py --weights ai_engine\runs\<run>\weights\best.pt --confidence 0.25 --imgsz 640 --device 0
```

The baseline is intentionally a single-class segmentation model. Detection
datasets with boxes only are retained for a separate detection benchmark and
are not converted into false polygon masks.

## Depth-aware research baseline

```powershell
python ai_engine\scripts\prepare_depth_dataset.py
python ai_engine\scripts\train_depth_aware.py --epochs 40
```

This benchmark accepts RGB plus Pothole-600 transformed disparity and predicts
a pothole mask. It is not a metric-depth model. A centimetre depth estimate
will only be introduced after we add calibrated RGB-D samples and validate
against physical measurements.

## Compare trained candidates

Run segmentation candidates with distinct `--model` and `--name` values, then:

```powershell
python ai_engine\scripts\summarize_benchmarks.py
```

This writes `ai_engine/artifacts/benchmark-report-v0.3.json` and keeps the
metric-depth limitation visible in the final comparison.

## Evaluate and integrate the selected model

Evaluate a checkpoint only on the held-out `test` split:

```powershell
python ai_engine\scripts\evaluate_segmentation.py --weights ai_engine\runs\yolo11n-seg-v0.3\weights\best.pt
```

For application integration, inference emits a JSON response containing a
confidence score, bounding box, and segmentation polygon for each pothole:

```powershell
python ai_engine\scripts\infer_segmentation.py path\to\road.jpg
```

The JSON includes `model_version` matching the engine release so downstream
incident provenance can trace the exact frozen model. It intentionally has no
centimetre depth field. Metric depth requires a
calibrated camera/RGB-D capture and ground-truth physical measurements.
Its stable web integration format is defined in
`contracts/ruasvision-inference-v0.2.schema.json`.

The API verifies the selected checkpoint SHA-256 against
`config/ruasvision-release-v0.3.yaml` before loading it. A mismatch stops model
startup instead of serving an unverified checkpoint.
