"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { ScanPoint, ScanReceipt } from "@/lib/scans";
import { detailURL, type Incident } from "@/lib/workspace";
import LiveCamera from "./live-camera";
import { ErrorMessage, PageTitle, useResource } from "./shared";
const RoadMap = dynamic(() => import("./map"), { ssr: false });

export default function ScanPage() {
  const router = useRouter();
  const [road, setRoad] = useState("");
  const [contributor, setContributor] = useState("");
  const [setup, setSetup] = useState<{ road: string; contributor: string }>();
  const [latest, setLatest] = useState<ScanReceipt>();
  const [sessionId, setSessionId] = useState("");
  const incidents = useResource<Incident[]>("/v1/incidents", 4000);
  const coverage = useResource<ScanPoint[]>("/v1/scans/coverage", 4000);
  const saved = useCallback((receipt: ScanReceipt, id: string) => {
    setLatest(receipt);
    setSessionId(id);
  }, []);
  const points = coverage.data ?? [];
  const currentPoints = sessionId ? points.filter((point) => point.session_id === sessionId) : points;
  return <>
    <PageTitle eyebrow="LIVE SCAN" title="Telusuri jalan. Catat temuannya." description="Live scan menyimpan jejak GPS dan mengirim kandidat kerusakan ke peta secara otomatis." />
    <div className="rk-scan-layout">
      <section aria-label="Kontrol live scan">
        {!setup ? <form className="rk-scan-setup" onSubmit={(event) => {
          event.preventDefault();
          if (road.trim().length >= 3 && contributor.trim().length >= 2) setSetup({ road: road.trim(), contributor: contributor.trim() });
        }}>
          <h2>Siapkan perjalanan</h2>
          <label className="rk-field">Nama ruas atau rute<input required minLength={3} maxLength={150} value={road} onChange={(event) => setRoad(event.target.value)} placeholder="Contoh: Jl. Kaliurang arah utara" /></label>
          <label className="rk-field">Nama pelapor<input required minLength={2} maxLength={100} value={contributor} onChange={(event) => setContributor(event.target.value)} autoComplete="name" /></label>
          <p className="rk-helper">Buka di HTTPS, izinkan kamera dan lokasi. Siapkan perangkat sebelum bergerak; gunakan penumpang atau dudukan, jangan mengoperasikan HP sambil mengemudi.</p>
          <button className="rk-button" type="submit">Siapkan live scan</button>
        </form> : <>
          <div className="rk-scan-route"><h2>{setup.road}</h2><p>{setup.contributor}</p></div>
          <LiveCamera automatic={setup} onSaved={saved} />
          <button className="rk-text-button" onClick={() => { setSetup(undefined); setLatest(undefined); setSessionId(""); }}>Akhiri dan ganti rute</button>
        </>}
        <div className="rk-scan-summary">
          <h2>Catatan sesi</h2>
          {latest ? <>
            <p>{latest.frame_count} frame tersimpan · {latest.incident_count} kandidat area</p>
            <p className="rk-helper">GPS frame terakhir ±{Math.round(latest.point.accuracy_m)} m. Posisi perangkat, belum posisi lubang terukur.</p>
            {latest.incident_id && <Link href={detailURL(latest.incident_id)} className="rk-button rk-secondary">Tinjau kandidat terbaru</Link>}
          </> : <p className="rk-helper">Belum ada frame tersimpan pada sesi ini. Mulai kamera setelah rute siap.</p>}
          <p className="rk-helper">Kandidat bukan hasil verifikasi. Tidak ada deteksi bukan jaminan jalan baik. Frame kurang tajam ditandai belum dinilai.</p>
        </div>
      </section>
      <section className="rk-scan-map" aria-label="Peta hasil scan">
        <header><h2>Jejak scan</h2><Link href="/map">Buka peta lengkap</Link></header>
        <RoadMap items={incidents.data ?? []} coverage={currentPoints} onSelect={(id) => router.push(detailURL(id))} pin={latest ? [latest.point.longitude, latest.point.latitude] : undefined} />
        <ScanLegend />
        <p className="rk-helper">Peta mengambil data tersimpan setiap 4 detik. Garis mengikuti GPS, belum dicocokkan dengan geometri ruas.</p>
        {!coverage.data && !coverage.error && <p role="status">Memuat jejak tersimpan…</p>}
        <ErrorMessage error={coverage.error || incidents.error || ""} />
      </section>
    </div>
  </>;
}
export function ScanLegend() {
  return <ul className="rk-scan-legend" aria-label="Legenda jejak scan">
    <li><span className="rk-scan-detected" />Ada deteksi</li>
    <li><span className="rk-scan-none" />Tidak terdeteksi pada sampel</li>
    <li><span className="rk-scan-uncertain" />Belum dapat dinilai</li>
  </ul>;
}
