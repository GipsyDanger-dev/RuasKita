# RuasKita Desktop Dashboard

Workspace desktop untuk pelaporan foto + RuasVision, peta koordinat, insiden,
perbaikan, RuasView bukti historis, analitik, snapshot laporan, dan kontributor.

Lihat [panduan lengkap, kontrak data, pengujian, dan batas MVP](../../docs/DESKTOP_WORKSPACE.md).

## Jalankan lokal

Di terminal pertama, dari root repository:

```powershell
.\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --reload --port 8000
```

Di terminal kedua:

```powershell
Set-Location apps\web
npm run dev
```

Buka `http://localhost:3000/dashboard`. API default adalah `http://127.0.0.1:8000`;
ubah `NEXT_PUBLIC_API_URL` bila service berjalan di alamat lain.

## Batasan MVP

- Data persisten lokal di SQLite. Supabase/Auth/RBAC produksi belum tersedia.
- Road Health/GeoFusion/depth metrik tidak diklaim tersedia.
- Laporan adalah snapshot internal + cetak, bukan PDF resmi terverifikasi.
- Jangan ekspos API dan web ini ke jaringan publik sebelum hardening dan auth.

## Verifikasi

```powershell
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E memakai server dan database sementara terpisah; tidak menjalankan training.
