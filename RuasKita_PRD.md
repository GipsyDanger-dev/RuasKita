# RuasKita
## Product Requirements Document

**Tagline:** Pantau, Laporkan, Perbaiki.  
**Product Type:** AI Road Intelligence & Maintenance Platform  
**Document Status:** Master PRD  
**Primary Market:** Indonesia  
**Architecture Principle:** Mobile-first, edge-assisted AI, geospatial-first, crowdsourced, evidence-based.

---

## 1. Executive Summary

RuasKita adalah platform pemantauan kondisi jalan berbasis Artificial Intelligence, Computer Vision, geospatial intelligence, dan kontribusi masyarakat.

Platform memungkinkan masyarakat, komunitas, kendaraan operasional, serta armada institusi untuk mendeteksi dan melaporkan kerusakan jalan melalui:

- laporan manual,
- foto,
- video,
- live camera detection,
- passive road scanning,
- fleet-based monitoring.

Computer Vision menganalisis kondisi jalan dan menghasilkan informasi seperti:

- jenis kerusakan,
- lokasi,
- tingkat keparahan,
- bentuk kerusakan,
- estimasi dimensi,
- estimasi kedalaman,
- confidence,
- perkembangan kerusakan,
- prioritas penanganan.

Setiap kerusakan tidak disimpan sebagai laporan terpisah, tetapi sebagai sebuah **Road Damage Incident** yang terus diperbarui berdasarkan observasi baru.

RuasKita juga menyediakan:

- Live Road Damage Map,
- Road Health Score,
- RuasView,
- historical road imagery,
- damage progression monitoring,
- repair lifecycle,
- before-after verification,
- verified PDF reports,
- road condition analytics.

Tujuan akhirnya adalah mengubah data visual dan laporan masyarakat menjadi **road intelligence yang dapat digunakan untuk menentukan lokasi, tingkat risiko, prioritas, dan progres penanganan kerusakan jalan.**

---

## 2. Product Vision

RuasKita ingin menjadi:

> Infrastruktur digital yang menyediakan kondisi aktual jaringan jalan berdasarkan AI, sensor, visual evidence, dan kontribusi masyarakat.

Platform tidak hanya mengetahui bahwa suatu jalan rusak.

RuasKita harus mampu menjawab:

- Di mana kerusakannya?
- Kerusakan jenis apa?
- Seberapa parah?
- Seberapa akurat lokasinya?
- Kapan pertama kali ditemukan?
- Apakah kondisinya memburuk?
- Berapa kali sudah terdeteksi?
- Mana yang harus diperbaiki lebih dahulu?
- Apakah sudah ditangani?
- Apakah perbaikannya benar-benar selesai?
- Bagaimana kondisi visual ruas tersebut sekarang?
- Bagaimana kondisinya dibandingkan beberapa minggu atau bulan sebelumnya?

---

## 3. Core Product Principle

RuasKita bukan:

> Aplikasi pendeteksi pothole.

RuasKita adalah:

> **AI-powered Road Intelligence & Maintenance Platform.**

Computer Vision merupakan salah satu komponen untuk menghasilkan road intelligence.

Core lifecycle:

```text
DETECT
  ↓
LOCATE
  ↓
VERIFY
  ↓
UNDERSTAND
  ↓
PRIORITIZE
  ↓
REPAIR
  ↓
RECHECK
  ↓
RESOLVE
```

---

## 4. Primary Problems

### 4.1 Pelaporan Jalan Bersifat Reaktif

Kerusakan biasanya diketahui setelah masyarakat mengeluh atau petugas melakukan inspeksi.

RuasKita memungkinkan:

```text
Continuous Monitoring
+
Crowdsourcing
+
AI Detection
```

### 4.2 Data Laporan Tidak Terstruktur

Laporan masyarakat sering hanya berupa:

- foto,
- alamat,
- teks,
- lokasi perkiraan.

RuasKita mengubahnya menjadi structured incident data.

### 4.3 Duplikasi Laporan

Kerusakan yang sama dapat dilaporkan puluhan orang.

RuasKita harus menggabungkan laporan tersebut sebagai satu incident.

### 4.4 Prioritas Penanganan Tidak Terlihat

Seratus laporan tidak berarti semuanya sama mendesaknya.

RuasKita menghasilkan **Repair Priority Score**.

### 4.5 Kondisi Jalan Tidak Dipantau Secara Historis

Kerusakan dapat berkembang tanpa terdeteksi.

RuasKita mempertahankan histori observasi dan perubahan visual.

### 4.6 Lokasi GPS Bisa Tidak Akurat

Koordinat perangkat tidak sama dengan koordinat pothole yang terlihat beberapa meter di depan kamera.

RuasKita menggunakan **GeoFusion**.

### 4.7 Tidak Ada Bukti Terstruktur Setelah Perbaikan

Incident dapat diverifikasi kembali menggunakan visual evidence terbaru.

---

## 5. Target Users

### 5.1 Masyarakat

Pengguna dapat:

- melihat kondisi jalan,
- melaporkan kerusakan,
- melakukan live detection,
- mengikuti status laporan,
- melihat hasil perbaikan.

### 5.2 Contributor

Pengguna aktif yang mengumpulkan road imagery dan detection melalui perjalanan sehari-hari.

Contoh:

- pengendara motor,
- pengemudi mobil,
- komunitas,
- ojol,
- relawan.

### 5.3 Pemerintah / Pengelola Jalan

Menggunakan:

- dashboard,
- road health map,
- priority ranking,
- analytics,
- report,
- repair monitoring.

### 5.4 Fleet Operator

Contoh:

- bus,
- kendaraan pemerintah,
- taxi,
- kendaraan logistik,
- kendaraan inspeksi.

Fleet dapat menjadi moving road-monitoring sensor.

### 5.5 Researcher / Analyst

Menggunakan historical dataset untuk:

- analisis kondisi jalan,
- urban planning,
- road deterioration research,
- infrastructure research.

---

## 6. Core Product Components

RuasKita terdiri dari empat subsystem utama.

```text
RUASKITA

├── RuasVision
├── RuasGeo
├── RuasDepth
└── RuasView
```

Ditambah supporting engines:

```text
Incident Engine
Verification Engine
Priority Engine
Road Health Engine
Report Engine
Repair Lifecycle Engine
```

---

## 7. RuasVision

### 7.1 Purpose

RuasVision merupakan Computer Vision Engine yang mendeteksi dan menganalisis kerusakan jalan.

### 7.2 Initial Detection Scope

MVP:

- pothole.

Future:

- longitudinal crack,
- transverse crack,
- alligator crack,
- rutting,
- edge damage,
- surface deterioration,
- subsidence,
- damaged markings,
- damaged drainage,
- other road infrastructure defects.

---

## 8. AI Model Strategy

Model tidak langsung dikunci sebelum benchmark.

Primary candidate:

**RF-DETR-Seg**

Baseline:

**YOLO26-Seg**

Alternative:

**D-FINE**

Temporal refinement:

**SAM 2**

Tracking:

**ByteTrack / equivalent temporal tracker**

---

## 9. Model Benchmark

Model harus diuji menggunakan dataset RuasKita.

Metrics:

- mAP50,
- mAP50-95,
- Mask mAP,
- Precision,
- Recall,
- F1,
- false-positive rate,
- false-negative rate,
- inference latency,
- FPS,
- model size,
- battery consumption,
- memory consumption.

Environmental benchmarks:

- daylight,
- night,
- rain,
- wet road,
- shadows,
- patched asphalt,
- markings,
- motion blur,
- high-speed movement,
- different camera angles,
- motorcycle,
- car.

Final model dipilih berdasarkan **RuasKita dataset**, bukan benchmark generic.

---

## 10. Edge + Cloud AI Architecture

RuasKita tidak mengirim seluruh video ke server.

### Edge

```text
Camera
 ↓
Frame sampling
 ↓
Lightweight detector
 ↓
Tracking
 ↓
Candidate detection
 ↓
Best evidence frame
```

Edge responsibilities:

- fast candidate detection,
- temporary tracking,
- keyframe selection,
- local caching,
- offline support.

### Cloud

```text
Evidence
 ↓
High-accuracy model
 ↓
Segmentation
 ↓
Severity
 ↓
Geo validation
 ↓
Duplicate detection
 ↓
Incident engine
```

Cloud responsibilities:

- final AI validation,
- high-resolution segmentation,
- duplicate analysis,
- severity calculation,
- road association,
- incident creation.

---

## 11. Live Detection

User dapat mengaktifkan:

**RuasKita Live**

Saat berkendara:

```text
Camera
 ↓
AI
 ↓
Candidate Damage
 ↓
Tracking
 ↓
Capture
 ↓
GeoFusion
 ↓
Cloud Validation
 ↓
Incident
```

Live Detection harus:

- hands-free,
- tidak membutuhkan interaction saat berkendara,
- menghindari video streaming penuh,
- tetap bekerja ketika jaringan buruk.

---

## 12. Candidate Incident

Detection tidak langsung menjadi laporan publik.

Lifecycle:

```text
DETECTED
 ↓
LOCATING
 ↓
CANDIDATE
 ↓
AI VALIDATED
 ↓
GEO VALIDATED
 ↓
VERIFIED
```

Confidence rendah dapat:

```text
WAITING FOR ADDITIONAL OBSERVATION
```

---

## 13. Temporal Tracking

Satu pothole yang terlihat pada beberapa frame harus dianggap sebagai satu object.

```text
Frame 101 → Damage #17
Frame 102 → Damage #17
Frame 103 → Damage #17

↓

1 Observation
```

---

## 14. Evidence Selection

Tidak semua frame disimpan.

Best-frame scoring mempertimbangkan:

- sharpness,
- blur,
- visibility,
- lighting,
- object size,
- obstruction,
- detection confidence,
- camera angle.

---

## 15. RuasGeo

RuasGeo adalah subsystem untuk menentukan lokasi fisik kerusakan secara akurat.

Tidak menggunakan:

```text
Pothole detected
→ Current GPS
```

karena posisi kamera ≠ posisi pothole.

---

## 16. GeoFusion Inputs

```text
GNSS / GPS
+
IMU
+
Camera Pose
+
Camera Intrinsics
+
Heading
+
Vehicle Trajectory
+
Depth
+
Road Network
```

---

## 17. Timestamp Synchronization

Setiap:

- camera frame,
- GNSS sample,
- IMU reading,

harus memiliki timestamp.

Sensor state diinterpolasi untuk memperoleh posisi pada saat frame direkam.

---

## 18. Object Geolocation

System menghitung:

```text
Device Position
+
Camera Direction
+
Object Position in Frame
+
Estimated Distance
=
Estimated Object Coordinate
```

---

## 19. Temporal Location Refinement

Pothole yang sama dapat terlihat berkali-kali.

Setiap frame menghasilkan coordinate estimate.

```text
Estimate A
Estimate B
Estimate C
Estimate D

↓

Robust Fusion

↓

Final Coordinate
```

---

## 20. Map Matching

RuasKita menggunakan:

**Valhalla / Meili**

dengan road network berbasis OpenStreetMap.

Input:

- trajectory,
- GPS accuracy,
- heading,
- speed,
- previous segment.

Output:

```text
road_segment_id
road_name
matched_coordinate
matching_confidence
```

---

## 21. PostGIS Road Association

Coordinate kerusakan tidak dipaksa berada di centerline jalan.

Stored separately:

```text
raw_location
fused_location
matched_road_segment
distance_to_road
location_accuracy
```

---

## 22. Location Confidence

Setiap incident memiliki:

```text
Location Confidence
Estimated Accuracy
```

Contoh:

```text
HIGH
±2.1 meter
```

Confidence mempertimbangkan:

- GNSS accuracy,
- IMU stability,
- camera pose,
- trajectory stability,
- depth confidence,
- map matching confidence,
- number of observations.

---

## 23. Crowdsourced Coordinate Refinement

Multiple observations:

```text
Observation A ±5m
Observation B ±3m
Observation C ±4m

↓

Weighted GeoFusion

↓

Incident ±1.8m
```

Lokasi incident dapat terus membaik.

---

## 24. RuasDepth

RuasDepth mengestimasi geometri kerusakan.

Output potensial:

- length,
- width,
- area,
- maximum depth,
- mean depth,
- approximate volume.

---

## 25. Measurement Levels

### Level 1 — Monocular AI

Hardware:

- smartphone standard camera.

Methods:

- Metric3D,
- Depth Anything Metric,
- camera geometry.

Output:

**estimated measurement**

### Level 2 — AR Depth

Android:

- ARCore Depth API.

iOS:

- ARKit depth.

Output:

lebih akurat dibanding monocular estimation.

### Level 3 — Hardware Depth

Devices:

- LiDAR,
- dedicated depth sensors,
- external scanning equipment.

Target:

inspection-grade measurements.

---

## 26. Road Plane Estimation

RuasDepth tidak hanya membaca camera depth.

Pipeline:

```text
Pothole Segmentation
+
Depth Map
 ↓
3D Point Cloud
 ↓
Road Plane Estimation
 ↓
Depression Measurement
```

RANSAC digunakan untuk mengestimasi normal road surface.

---

## 27. Measurement Confidence

Setiap ukuran harus memiliki:

```text
Measurement Method
Measurement Confidence
```

Contoh:

```text
Estimated Max Depth
~6–9 cm

Method
Monocular AI

Confidence
MEDIUM
```

False precision harus dihindari.

---

## 28. Scan Mode

Selain Live Mode tersedia:

**Measure Damage**

User bergerak perlahan mengelilingi kerusakan.

System membangun 3D representation.

Output:

```text
Length
Width
Depth
Area
Volume
3D Surface
Confidence
```

---

## 29. RuasView

RuasView merupakan street-level road imagery system.

Tujuan:

User dapat membuka ruas jalan dan melihat kondisi visual terbaru seperti Street View, tetapi difokuskan pada **road condition intelligence**.

---

## 30. RuasView Capture

Live Detection juga dapat menghasilkan keyframes untuk RuasView.

```text
Live Camera
 ↓
Quality Filter
 ↓
Keyframe Selection
 ↓
GeoFusion
 ↓
Road Matching
 ↓
Privacy Processing
 ↓
Street Imagery
```

---

## 31. Keyframe Strategy

Tidak menyimpan continuous video.

Contoh:

```text
0m
5m
10m
15m
20m
```

Keyframe spacing adaptif berdasarkan:

- vehicle speed,
- environmental change,
- visual overlap,
- road geometry,
- storage policy.

---

## 32. RuasView Navigation

User dapat:

```text
← Previous

Current View

Next →
```

Map pointer selalu sinkron dengan street view.

---

## 33. RuasView AI Overlay

Available layers:

```text
AI Damage
Severity
Depth
Repair Status
Historical Changes
Raw Image
```

Klik kerusakan membuka Incident Detail.

---

## 34. Historical RuasView

RuasKita mempertahankan street imagery history.

User dapat menggunakan timeline:

```text
July
August
September
October
```

untuk melihat perubahan ruas.

---

## 35. Damage Progression

AI membandingkan observasi:

```text
Previous
vs
Current
```

Output:

```text
Condition worsened
Severity Medium → High
Area increased
```

---

## 36. Before / After Repair

```text
BEFORE

Pothole
High

↓

REPAIR

↓

AFTER

No significant damage detected

↓

Resolved Candidate
```

Incident dapat ditutup setelah verification.

---

## 37. RuasView Freshness

Setiap street segment memiliki:

```text
Last Captured
Coverage
Image Quality
Freshness
```

Categories:

```text
Fresh
Aging
Stale
No Data
```

---

## 38. Privacy Pipeline

Sebelum imagery dipublikasikan:

```text
Face Detection
+
License Plate Detection
 ↓
Automatic Blur
 ↓
Published Image
```

Public imagery tidak boleh menampilkan identifiable information secara sengaja.

---

## 39. Manual Reporting

User dapat:

1. mengambil foto,
2. memilih atau menerima lokasi otomatis,
3. melihat hasil AI,
4. menambahkan catatan,
5. mengirim.

System melakukan:

- AI analysis,
- GeoFusion where possible,
- duplicate checking,
- incident linking.

---

## 40. Duplicate Detection Engine

Duplicate decision mempertimbangkan:

```text
Spatial distance
+
Road segment
+
Visual similarity
+
Damage type
+
Temporal proximity
+
Direction
```

Visual embeddings disimpan menggunakan **pgvector**.

---

## 41. Incident Model

Setiap physical damage direpresentasikan sebagai satu incident.

Example:

```text
RK-INC-000182

Type
Pothole

Severity
HIGH

Detection Confidence
97%

Location Confidence
94%

Measurement Confidence
88%

Observations
14

Status
VERIFIED
```

---

## 42. Incident Lifecycle

```text
Candidate

AI Verified

Community Verified

Inspection Required

Assigned

In Repair

Repair Reported

Recheck Required

Resolved

Reopened
```

---

## 43. Road Health Score

Setiap road segment memiliki score:

```text
0–100
```

Dipengaruhi oleh:

- number of incidents,
- severity,
- damage density,
- incident age,
- deterioration trend,
- resolved incidents,
- road exposure.

---

## 44. Priority Engine

Repair Priority Score:

```text
Severity
+
Damage Geometry
+
Incident Age
+
Traffic Exposure
+
Location Risk
+
Observation Count
+
Growth Rate
+
Verification Confidence
```

Output:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

dengan score 0–100.

---

## 45. Priority Explainability

Score harus memiliki alasan.

Example:

```text
Priority Score
91/100

Primary Factors

High severity
Growing rapidly
Located in wheel path
Detected 17 times
Unresolved for 18 days
```

---

## 46. Live Road Map

Map menampilkan:

- road health,
- active incidents,
- critical incidents,
- verified incidents,
- candidates,
- repairs,
- resolved incidents,
- RuasView coverage.

---

## 47. Map Layers

```text
Damage
Severity
Road Health
Repairs
Historical
Freshness
Contributor Coverage
RuasView
```

---

## 48. Real-Time Updates

Event types:

```text
incident.created
incident.updated
incident.verified
incident.assigned
incident.repaired
incident.resolved
road.health.updated
capture.created
```

Map diperbarui melalui realtime event.

---

## 49. Contributor System

Contributor profile memiliki:

- total observations,
- accepted detections,
- verified detections,
- coverage distance,
- contribution score.

Future:

- contributor reputation,
- badges,
- institution verified contributors.

Gamification tidak boleh merusak data quality.

---

## 50. Offline Operation

Live mode harus tetap dapat berjalan tanpa koneksi.

```text
Detection
 ↓
Local Queue
 ↓
Connection restored
 ↓
Sync
```

Stored temporarily:

- candidate metadata,
- evidence image,
- trajectory subset,
- sensor metadata.

---

## 51. Verified Road Condition Report

User dapat memilih:

```text
Road
Area
Period
Report Scope
```

Kemudian:

```text
Generate Verified PDF
```

---

## 52. PDF Contents

Report berisi:

### Cover

- RuasKita branding,
- report title,
- road name,
- period,
- generated date,
- Report ID.

### Executive Summary

### Road Health Score

### Incident Statistics

### Severity Distribution

### Road Condition Map

### Incident Details

### Damage Images

### Segmentation

### Depth / Geometry

### Historical Comparison

### Repair Status

### Priority Analysis

### Methodology

### Data Quality

### Verification

---

## 53. Report Verification

Setiap PDF memiliki:

- watermark,
- Report ID,
- generated timestamp,
- QR code,
- document hash,
- verification page.

---

## 54. Report Snapshot

PDF merupakan snapshot kondisi data pada waktu tertentu.

Tidak otomatis berubah jika database berubah.

---

## 55. Report Integrity

SHA-256 hash digunakan untuk memastikan file tidak dimodifikasi.

Verification page:

```text
Valid Report
Generated by RuasKita
Generated Date
Data Snapshot
Document Hash
Version
```

---

## 56. Main Mobile Application

Technology:

**Flutter + Dart**

Primary navigation:

```text
Home
Map
Live
Report
Contribution
Profile
```

---

## 57. Web Dashboard

Technology:

- Next.js,
- React,
- TypeScript,
- Tailwind CSS,
- shadcn/ui.

Primary modules:

```text
Overview
Live Map
Roads
Incidents
Repairs
RuasView
Analytics
Reports
Contributors
System
```

---

## 58. Map Technology

**MapLibre GL**

Road data:

**OpenStreetMap**

Routing / map matching:

**Valhalla / Meili**

Geospatial database:

**PostGIS**

---

## 59. Backend

Technology:

**Python + FastAPI**

Modules:

```text
auth
users
contributors
roads
incidents
detections
captures
geofusion
depth
verification
priority
reports
repairs
analytics
ai
```

---

## 60. Database

Primary:

**PostgreSQL**

Extensions:

```text
PostGIS
pgvector
```

Supporting:

**Redis**

---

## 61. Storage

Supabase Storage:

```text
damage-originals/
damage-evidence/
damage-processed/
ruasview/
thumbnails/
reports/
```

---

## 62. Authentication

**Supabase Auth**

Supported initially:

- email,
- Google,
- anonymous contributor upgrade path.

---

## 63. Realtime

Use:

- Supabase Realtime,
- WebSocket where needed.

---

## 64. Background Jobs

Redis-backed worker handles:

- AI validation,
- image processing,
- privacy processing,
- duplicate analysis,
- PDF generation,
- map analytics,
- historical comparisons.

---

## 65. Core Technology Stack

```text
MOBILE
Flutter
Dart

WEB
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
MapLibre GL

BACKEND
Python
FastAPI

VISION
PyTorch
RF-DETR-Seg
YOLO Segmentation baseline
D-FINE benchmark
SAM 2
ByteTrack
OpenCV
Albumentations

EDGE
ONNX Runtime Mobile
TFLite / ExecuTorch where appropriate

DEPTH
Depth Anything Metric
Metric3D
ARCore Depth
ARKit SceneDepth
Open3D

GEOSPATIAL
PostgreSQL
PostGIS
OpenStreetMap
Valhalla / Meili

VECTOR
pgvector

PLATFORM
Supabase Auth
Supabase Storage
Supabase Realtime

CACHE / QUEUE
Redis

REPORT
HTML
CSS
Playwright
QR Code
SHA-256

INFRASTRUCTURE
Docker
Vercel
Linux VPS
Supabase

ANNOTATION
CVAT
```

---

## 66. Core Data Entities

```text
User
Contributor
Device

Road
RoadSegment
RoadHealth

CaptureSequence
StreetCapture

Detection
Observation
Incident

IncidentEvidence
DamageMeasurement

Repair
RepairEvidence

Report
ReportSnapshot

AIModel
ModelVersion
```

---

## 67. AI Model Versioning

Setiap detection harus menyimpan:

```text
model_name
model_version
confidence
inference_timestamp
```

Agar hasil dapat diaudit dan dibandingkan antarversi model.

---

## 68. Auditability

Critical changes harus memiliki history:

```text
Incident created
Severity changed
Coordinate refined
Status changed
Repair submitted
Incident resolved
Incident reopened
```

---

## 69. Non-Functional Requirements

### Performance

Mobile UI:

60 FPS target.

Live inference:

interactive real-time.

Map:

smooth pan/zoom dengan clustering.

### Scalability

System harus dapat berkembang dari:

```text
100 observations/day
```

ke:

```text
1,000,000+ observations/day
```

tanpa mengubah core domain model.

### Availability

Critical APIs harus mampu graceful degradation.

### Security

Implement:

- HTTPS,
- RBAC,
- signed storage URLs,
- rate limiting,
- input validation,
- audit logs.

### Privacy

Implement:

- face blur,
- plate blur,
- EXIF sanitization,
- configurable retention,
- data deletion workflows.

---

## 70. Success Metrics

### AI

Detection recall:
> 90% target setelah dataset matang.

False positive:
< 5% target production.

### Geolocation

Median incident position error:

< 5 meter smartphone mode.

Target improvement:

< 3 meter dengan multi-observation fusion.

### Data Quality

Duplicate merge precision:
> 95%.

### Platform

- Percentage verified incidents.
- Average observations per road.
- Road imagery freshness.

### Maintenance

Time:

```text
Detection → Verification

Verification → Repair

Repair → Resolution
```

---

## 71. MVP Scope

MVP wajib memiliki:

- pothole detection,
- manual report,
- live detection,
- candidate incident,
- GPS + basic GeoFusion,
- road matching,
- duplicate prevention,
- live map,
- severity,
- Road Health Score,
- incident detail,
- repair lifecycle,
- PDF report,
- basic RuasView,
- historical observations.

---

## 72. Not Required for MVP

Tidak wajib pada first release:

- full 360° imagery,
- centimeter RTK GNSS,
- full LiDAR support,
- government integration,
- automatic material estimation,
- nationwide deployment,
- autonomous repair dispatch,
- microservices,
- Kubernetes.

---

## 73. Development Strategy

Development menggunakan incremental vertical slices.

Setiap sprint harus menghasilkan sistem yang masih dapat dijalankan.

Tidak membangun semua infrastructure terlebih dahulu sebelum fitur user bekerja.

---

## 74. Sprint Duration

Recommended:

**2 minggu / sprint**

Total initial roadmap:

**12 Sprint / ±24 minggu**

---

# SPRINT 0 — FOUNDATION

## Goal

Membentuk repository dan arsitektur dasar RuasKita.

## Deliverables

- monorepo,
- Flutter app,
- Next.js dashboard,
- FastAPI,
- PostgreSQL,
- PostGIS,
- Supabase,
- Docker environment,
- CI pipeline,
- environment management,
- coding convention,
- API convention,
- initial database schema.

## Exit Criteria

```text
Flutter → API → PostgreSQL
Web → API → PostgreSQL
```

berjalan end-to-end.

---

# SPRINT 1 — DATASET & FIRST VISION

## Goal

Membuat model pertama yang mampu mendeteksi pothole.

## Tasks

- collect initial dataset,
- dataset cleaning,
- CVAT annotation,
- train YOLO baseline,
- train RF-DETR,
- evaluate,
- create benchmark pipeline.

## Deliverables

```text
RuasVision v0.1
```

## Exit Criteria

Model dapat mendeteksi pothole pada test video dengan metrik tercatat.

---

# SPRINT 2 — MANUAL REPORTING

## Goal

User dapat melaporkan kerusakan dari smartphone.

## Features

```text
Camera
Photo Upload
GPS
AI Detection
Severity
Submit
```

## Backend

- detection endpoint,
- evidence storage,
- incident creation,
- user contribution.

## Exit Criteria

```text
Foto pothole
→ AI analysis
→ submit
→ incident appears on map
```

---

# SPRINT 3 — LIVE DETECTION

## Goal

Computer Vision berjalan langsung dari kamera.

## Features

- live camera,
- frame sampling,
- edge inference,
- temporal tracking,
- keyframe selection,
- candidate detection,
- offline queue.

## Deliverable

```text
RuasKita Live v0.1
```

## Exit Criteria

Perjalanan singkat dapat menghasilkan candidate pothole tanpa manual capture.

---

# SPRINT 4 — RUASGEO

## Goal

Menghasilkan lokasi pothole yang lebih akurat daripada current-device GPS.

## Implement

- timestamp synchronization,
- GNSS,
- heading,
- IMU,
- camera orientation,
- trajectory,
- object bearing estimation.

## Server

- PostGIS,
- road segment association,
- Valhalla map matching.

## Deliverable

```text
RuasGeo v0.1
```

## Exit Criteria

Detection dapat dikaitkan ke road segment yang benar.

---

# SPRINT 5 — INCIDENT & DUPLICATE ENGINE

## Goal

Multiple observations menjadi satu physical incident.

## Implement

```text
PostGIS proximity
+
Road segment
+
Time
+
Visual embedding
+
Damage type
```

## Features

- observation entity,
- incident entity,
- duplicate detection,
- coordinate refinement,
- verification confidence.

## Exit Criteria

Beberapa detection terhadap pothole yang sama tidak menghasilkan incident baru.

---

# SPRINT 6 — SEVERITY & ROAD HEALTH

## Goal

Mengubah detection menjadi actionable road intelligence.

## Implement

- segmentation analysis,
- severity model,
- priority score,
- priority explanation,
- Road Health Score.

## Dashboard

- severity map,
- road health layer,
- priority ranking.

## Deliverable

```text
Road Intelligence Engine v0.1
```

---

# SPRINT 7 — RUASDEPTH

## Goal

Mengukur geometri kerusakan.

## Implement

- metric monocular depth,
- pothole mask,
- local road plane,
- point cloud,
- RANSAC,
- length,
- width,
- estimated depth,
- area,
- volume,
- measurement confidence.

## Experimental

- ARCore Depth.

## Deliverable

```text
RuasDepth v0.1
```

---

# SPRINT 8 — RUASVIEW

## Goal

Membangun visual street-level road inspection.

## Implement

- capture sequence,
- keyframe generation,
- geolocation,
- heading,
- road association,
- street viewer,
- next/previous navigation,
- synchronized mini-map.

## Deliverable

```text
RuasView v0.1
```

## Exit Criteria

User dapat membuka Jalan X dan menjelajahi imagery berdasarkan posisi jalan.

---

# SPRINT 9 — RUASVIEW INTELLIGENCE

## Goal

Menjadikan RuasView lebih dari sekadar street imagery.

## Features

- AI damage overlay,
- click incident,
- imagery freshness,
- historical imagery,
- timeline slider,
- before-after comparison,
- damage progression.

## Privacy

- face blur,
- license plate blur.

## Deliverable

```text
RuasView Intelligence v1
```

---

# SPRINT 10 — REPAIR MANAGEMENT

## Goal

Melengkapi lifecycle dari detection sampai resolved.

## Implement

```text
Verified
→ Assigned
→ Repair
→ Recheck
→ Resolved
```

## Features

- repair evidence,
- before-after,
- AI recheck,
- reopen incident,
- repair statistics.

## Exit Criteria

Satu pothole dapat melewati lifecycle penuh.

---

# SPRINT 11 — VERIFIED REPORT ENGINE

## Goal

Menghasilkan laporan formal kondisi jalan.

## Implement

- road selection,
- date range,
- executive summary,
- health score,
- statistics,
- incident detail,
- damage imagery,
- map,
- depth data,
- priority analysis,
- historical data.

## Security

- watermark,
- Report ID,
- QR verification,
- SHA-256 hash,
- report snapshot.

## Deliverable

```text
RuasKita Verified Report v1
```

---

# SPRINT 12 — PRODUCTION HARDENING & PILOT

## Goal

Mempersiapkan RuasKita untuk pilot lapangan.

## Work

### AI

- retraining,
- false-positive analysis,
- edge optimization,
- night/rain testing.

### Geospatial

- coordinate error benchmark,
- trajectory optimization,
- map matching improvements.

### Mobile

- battery testing,
- thermal testing,
- offline sync,
- crash recovery.

### Backend

- load testing,
- queue optimization,
- security review,
- monitoring.

### Product

- UX refinement,
- accessibility,
- onboarding,
- contributor flow.

## Pilot

Test pada area terbatas:

```text
1 city / district
↓
Selected road network
↓
Real contributor
↓
Real vehicles
```

## Exit Criteria

RuasKita siap digunakan dalam closed pilot.

---

## 75. Roadmap Summary

```text
SPRINT 0
Foundation

SPRINT 1
Computer Vision

SPRINT 2
Manual Reporting

SPRINT 3
Live Detection

SPRINT 4
GeoFusion

SPRINT 5
Incident + Duplicate Engine

SPRINT 6
Severity + Road Intelligence

SPRINT 7
3D / Depth Measurement

SPRINT 8
RuasView

SPRINT 9
RuasView Intelligence

SPRINT 10
Repair Lifecycle

SPRINT 11
Verified PDF Reports

SPRINT 12
Production + Field Pilot
```

---

## 76. Major Milestones

### Milestone 1 — First AI Detection
RuasKita berhasil mendeteksi pothole.  
**Sprint 1.**

### Milestone 2 — First Community Report
User berhasil membuat incident melalui mobile.  
**Sprint 2.**

### Milestone 3 — First Autonomous Detection
Pothole ditemukan saat kendaraan bergerak tanpa manual report.  
**Sprint 3.**

### Milestone 4 — First Accurate Road Incident
RuasGeo menghubungkan detection dengan road segment.  
**Sprint 4.**

### Milestone 5 — First Living Incident
Beberapa observation memperbarui satu incident.  
**Sprint 5.**

### Milestone 6 — First Road Intelligence
RuasKita menentukan severity dan priority.  
**Sprint 6.**

### Milestone 7 — First 3D Damage Measurement
Pothole memiliki estimasi geometry.  
**Sprint 7.**

### Milestone 8 — First RuasView Street
User dapat menjelajah ruas secara visual.  
**Sprint 8.**

### Milestone 9 — First Historical Road
User dapat melihat perubahan kondisi dari waktu ke waktu.  
**Sprint 9.**

### Milestone 10 — First Complete Repair Lifecycle

```text
Detected
→ Repaired
→ AI Verified
→ Resolved
```

**Sprint 10.**

### Milestone 11 — First Verified Road Condition Report
PDF resmi RuasKita berhasil dihasilkan dan diverifikasi.  
**Sprint 11.**

### Milestone 12 — First Real-World Pilot
RuasKita digunakan pada kondisi jalan sebenarnya.  
**Sprint 12.**

---

## 77. Future Roadmap

### Fleet Intelligence
Dedicated fleet monitoring dashboard.

### RTK Mode
External RTK GNSS integration.

### Full 360 RuasView
360° street capture.

### Advanced Infrastructure Detection

- damaged signs,
- drainage,
- road markings,
- guardrail,
- street lights.

### Predictive Maintenance

Prediksi:

```text
Which road will deteriorate next?
```

### Maintenance Cost Intelligence

Estimasi kebutuhan:

- material,
- repair size,
- intervention priority.

### Government API

Integration ke:

- public works systems,
- ticketing,
- work orders,
- procurement systems.

### Open Data API

Controlled road-condition dataset access.

---

## 78. Product North Star

Keberhasilan RuasKita tidak diukur dari:

> berapa banyak pothole yang dideteksi AI.

Tetapi dari kemampuan platform menghasilkan:

> **informasi kondisi jalan yang akurat, terbaru, dapat diverifikasi, dan dapat digunakan untuk menentukan tindakan.**

---

## 79. Final Product Definition

**RuasKita — Pantau, Laporkan, Perbaiki.**

RuasKita adalah platform AI road intelligence yang menggabungkan:

```text
Crowdsourcing
+
Computer Vision
+
Live Detection
+
Depth Intelligence
+
GeoFusion
+
Street-Level Imagery
+
Road Health Analytics
+
Repair Tracking
+
Verified Reporting
```

untuk membangun representasi digital yang terus diperbarui mengenai kondisi jaringan jalan.

Tujuan akhirnya:

> **Mengetahui di mana jalan rusak, seberapa parah, bagaimana kondisinya berkembang, mana yang harus ditangani terlebih dahulu, dan apakah kerusakan tersebut telah benar-benar diperbaiki.**
