"use client";

import { ChangeEvent, useEffect, useState } from "react";

type Pothole = { confidence: number; bbox_xyxy: number[]; polygon_xy: number[][] };
type InferenceResponse = { engine: string; confidence_threshold: number; potholes: Pothole[]; depth_policy: string };
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function Home() {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [result, setResult] = useState<InferenceResponse>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected); setPreview(URL.createObjectURL(selected)); setResult(undefined); setError(undefined);
  }
  async function analyze() {
    if (!file) return;
    setIsLoading(true); setError(undefined);
    try {
      const body = new FormData(); body.append("image", file);
      const response = await fetch(`${API_URL}/v1/inference/image?confidence=0.5`, { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "Analisis gambar gagal.");
      setResult(payload as InferenceResponse);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "API tidak dapat dihubungi."); }
    finally { setIsLoading(false); }
  }
  return <main>
    <header className="topbar"><div className="brand"><span>R</span> RuasKita</div><div className="release">RuasVision v0.3 · Offline release</div></header>
    <section className="hero"><p className="eyebrow">DESKTOP AI WORKBENCH</p><h1>Analisis kondisi jalan<br />dengan bukti visual.</h1><p className="lede">Unggah satu foto jalan untuk mendeteksi dan mensegmentasi pothole dengan checkpoint RuasVision yang telah dibekukan.</p></section>
    <section className="workspace">
      <div className="panel upload-panel"><div className="panel-heading"><p>01 / INPUT</p><h2>Foto jalan</h2></div>
        <label className={`dropzone ${preview ? "has-file" : ""}`}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} />{preview ? <img src={preview} alt="Pratinjau foto jalan" /> : <><strong>Pilih foto jalan</strong><span>JPEG, PNG, atau WebP</span></>}</label>
        <button type="button" onClick={analyze} disabled={!file || isLoading}>{isLoading ? "Menganalisis…" : "Analisis dengan RuasVision"}</button>
        {error && <p className="error">{error}. Jalankan API di port 8000 terlebih dahulu.</p>}
      </div>
      <div className="panel result-panel"><div className="panel-heading"><p>02 / HASIL</p><h2>Temuan segmentasi</h2></div>
        {!result && <div className="empty"><span>◎</span><p>Hasil analisis akan tampil di sini.</p></div>}
        {result && <><div className="result-summary"><strong>{result.potholes.length}</strong><span>pothole terdeteksi</span><small>confidence threshold {Math.round(result.confidence_threshold * 100)}%</small></div><div className="detections">{result.potholes.map((pothole, index) => <article key={index}><span>#{String(index + 1).padStart(2, "0")}</span><b>{Math.round(pothole.confidence * 100)}% confidence</b><small>{pothole.polygon_xy.length} titik polygon</small></article>)}{result.potholes.length === 0 && <p className="clear">Tidak ada pothole yang terdeteksi pada threshold ini.</p>}</div><p className="policy">{result.depth_policy}</p></>}
      </div>
    </section>
    <footer>Deteksi AI adalah evidence awal. Validasi lapangan tetap diperlukan untuk keputusan perbaikan.</footer>
  </main>;
}
