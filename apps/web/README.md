# RuasKita Desktop Dashboard

Desktop MVP untuk alur unggah gambar jalan dan menerima hasil RuasVision.

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

Buka `http://localhost:3000`. API default adalah `http://127.0.0.1:8000`;
ubah `NEXT_PUBLIC_API_URL` bila service berjalan di alamat lain.

## Batasan MVP

- Input saat ini satu gambar jalan per analisis.
- Hasil menampilkan confidence, bounding box, dan polygon RuasVision.
- Tidak ada klaim kedalaman fisik dalam cm.
