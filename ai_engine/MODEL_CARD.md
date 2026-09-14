# RuasVision v0.3 model card

## Selected segmentation checkpoint

`runs/yolo11n-seg-v0.3-comparison/weights/best.pt` is the frozen offline
release checkpoint. SHA-256:
`368dd3d40bc8cae11e0108d164d461669da9bf5118d8195cd1075afa33053c26`.
It was selected over YOLO11s-Seg through the pre-declared, independently
pretrained comparison cohort on `ruaskita-seg-v0.3`.

| Metric (744-image v0.3 test split) | Result |
| --- | ---: |
| Mask precision | 0.661 |
| Mask recall | 0.627 |
| Mask mAP50 | 0.664 |
| Mask mAP50-95 | 0.345 |
| Image-level precision at confidence 0.50 | 0.998 |
| Image-level recall at confidence 0.50 | 0.912 |
| Normal-road false-positive rate at confidence 0.50 | 0.017 |

The clean YOLO11n cohort beat YOLO11s on held-out mask mAP50-95 (0.345 vs
0.262), image-level recall at confidence 0.50 (0.912 vs 0.606), and
hard-negative false-positive rate at confidence 0.25 (0/59 vs 2/59). The
earlier YOLO26n-Seg run was a short screening experiment on a different dataset
version and is not a like-for-like release comparison. Field validation remains
a separate final acceptance stage.

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
