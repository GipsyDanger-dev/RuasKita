# RuasVision v0.3 model card

## Selected segmentation checkpoint

`runs/yolo11n-seg-v0.3/weights/best.pt` is the incumbent offline candidate,
not the final frozen integration checkpoint. It may be used only for local
integration prototyping while the fair architecture comparison is pending.
It is trained on the leakage-free `ruaskita-seg-v0.3` split after an audit
excluded Dataset4 images with empty but unreliable annotations.

| Metric (744-image v0.3 test split) | Result |
| --- | ---: |
| Mask precision | 0.685 |
| Mask recall | 0.595 |
| Mask mAP50 | 0.646 |
| Mask mAP50-95 | 0.338 |
| Image-level precision at confidence 0.50 | 0.998 |
| Image-level recall at confidence 0.50 | 0.870 |
| Normal-road false-positive rate at confidence 0.50 | 0.017 |

The earlier YOLO26n-Seg run was a short screening experiment on a different
dataset version and is not a like-for-like release comparison. The v0.3
checkpoint is the incumbent offline candidate. The final release checkpoint
will be selected only after the clean YOLO11n and YOLO11s comparison cohort
passes the shared held-out and false-positive evaluations; field validation
then remains a separate final acceptance stage.

## Data controls

- 3,946 normalized samples: 2,522 train / 680 validation / 744 test.
- One class: `pothole`.
- Exact image hashes were deduplicated before splitting; the resulting
  manifest has zero hash groups spanning more than one split.
- Dataset4 images with empty annotations are excluded after visual audit found
  clear unlabelled potholes. Dataset1 normal-road images provide clean
  hard-negative supervision.
- The raw input datasets remain unmodified under `Dataset/`.

## Depth-aware research model

`artifacts/depth-aware-v0.1/best.pt` accepts RGB plus Pothole-600 transformed
disparity. It reached test Dice 0.753 and IoU 0.642. This signal is relative
disparity only: it must not be presented as pothole depth in centimetres.

## Integration contract

Run `scripts/infer_segmentation.py` with a road image. It defaults to a 0.50
confidence threshold and emits a JSON object
with a confidence, `bbox_xyxy`, and `polygon_xy` for each detected pothole.
There is intentionally no physical-depth field. Full machine-readable
benchmark evidence is in `artifacts/benchmark-report-v0.3.json`.
