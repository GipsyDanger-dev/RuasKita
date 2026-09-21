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

### Akses dari HP di Wi-Fi yang sama

API tetap terikat ke loopback. Next.js dapat mem-proxy API pada origin web agar
HP hanya perlu membuka satu port:

```powershell
$env:NEXT_PUBLIC_API_URL = "/api"
$env:RUASKITA_API_PROXY_TARGET = "http://127.0.0.1:8000"
$env:RUASKITA_ALLOWED_DEV_ORIGINS = "<IP-KOMPUTER>"
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Cari alamat IPv4 komputer dengan `ipconfig`, lalu buka
`http://<IP-KOMPUTER>:3000/dashboard` dari HP pada Wi-Fi yang sama. Jika
Windows Firewall meminta izin, izinkan Node.js pada jaringan **Private** saja.
Untuk live camera/video, gunakan HTTPS development dan buka
`https://<IP-KOMPUTER>:3000/incidents/new`; browser mungkin meminta konfirmasi
sertifikat lokal sebelum izin kamera muncul.

Sesi yang sedang berjalan di komputer ini sudah menggunakan HTTPS pada port
3000. Dengan alamat Wi-Fi saat ini, URL kamera adalah
`https://192.168.1.32:3000/incidents/new`.

Jika Windows Firewall tidak menampilkan dialog izin, jalankan PowerShell sebagai
Administrator dan batasi rule ke subnet lokal:

```powershell
New-NetFirewallRule -DisplayName "RuasKita LAN Preview 3000" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 `
  -RemoteAddress LocalSubnet -Profile Private,Public
```

## Batasan MVP

- Data persisten lokal di SQLite. Supabase/Auth/RBAC produksi belum tersedia.
- Road Health/GeoFusion/depth metrik tidak diklaim tersedia.
- Laporan adalah snapshot internal + cetak, bukan PDF resmi terverifikasi.
- Jangan ekspos API atau web ini ke jaringan publik sebelum hardening dan auth.

## Verifikasi

```powershell
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E memakai server dan database sementara terpisah; tidak menjalankan training.
