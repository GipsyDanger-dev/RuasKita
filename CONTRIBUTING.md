# Aturan kontribusi dan riwayat Git

Riwayat Git RuasKita adalah dokumentasi proyek. Setiap perubahan—minor atau
mayor—harus memiliki commit dan push terpisah setelah perubahan tersebut
terverifikasi. Jangan mencampurkan pekerjaan yang tidak berhubungan dalam satu
commit.

## Perubahan minor

Perubahan minor mencakup perbaikan typo, dokumentasi, konfigurasi kecil,
refactor tanpa perubahan perilaku, atau bug fix kecil.

- Buat satu commit atomik untuk satu maksud perubahan.
- Gunakan Conventional Commit, misalnya `docs: clarify depth limitation` atau
  `fix: preserve empty mask labels`.
- Jalankan pemeriksaan relevan, lalu push segera ke branch aktif.

## Perubahan mayor

Perubahan mayor mencakup fitur baru, perubahan API/model, migrasi data,
perubahan arsitektur, atau training benchmark baru.

- Pisahkan menjadi beberapa commit atomik yang mudah direview: misalnya
  `feat:` untuk implementasi, `test:` untuk verifikasi, dan `docs:` untuk
  dokumentasi/model card.
- Jangan memasukkan perubahan minor yang tidak terkait ke rangkaian commit
  fitur tersebut.
- Sebelum push, perbarui dokumentasi, hasil evaluasi, dan kontrak API bila
  perilaku sistem berubah.

## Checklist wajib sebelum push

1. Pastikan `git status` hanya memuat perubahan yang memang dimaksudkan.
2. Jalankan lint/test/skrip verifikasi yang relevan dengan perubahan.
3. Pastikan commit message menjelaskan *apa* dan *mengapa* perubahan dibuat.
4. Untuk model: simpan metrik test terpisah dan perbarui model card/benchmark.
5. Push commit yang sudah terverifikasi ke branch aktif.

## Data dan artefak model

Jangan commit raw dataset, processed dataset, checkpoint `.pt`, training run,
atau artefak besar. `.gitignore` telah mengecualikannya. Commit hanya script,
konfigurasi, manifest/ringkasan yang kecil, dokumentasi, dan kode aplikasi.

## Contoh alur

```powershell
git status
git add ai_engine\scripts\infer_segmentation.py ai_engine\README.md
git commit -m "feat: expose pothole polygons as inference JSON"
git push
```
