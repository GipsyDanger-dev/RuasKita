"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/workspace/theme";
import "./home.css";

const points = [
  { x: 60.7, y: 37.5, color: "red", name: "Jl. Kaliurang" },
  { x: 50.8, y: 27.2, color: "amber", name: "Jl. Palagan" },
  { x: 49.1, y: 39.8, color: "red", name: "Jl. Magelang" },
  { x: 44.2, y: 47.9, color: "green", name: "Jl. Godean" },
  { x: 53.4, y: 51.8, color: "amber", name: "Jl. Wates" },
  { x: 71.2, y: 42.9, color: "amber", name: "Jl. Solo" },
  { x: 86.2, y: 37.5, color: "amber", name: "Jl. Ring Road" },
  { x: 75.2, y: 49.9, color: "amber", name: "Jl. Janti" },
  { x: 65.7, y: 56.5, color: "green", name: "Jl. Parangtritis" },
  { x: 78.9, y: 60.3, color: "red", name: "Jl. Wonosari" },
  { x: 61.5, y: 65.9, color: "amber", name: "Jl. Bantul" },
];
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    arrow: "M4 12h16m-6-6 6 6-6 6",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    calendar: "M8 2v4m8-4v4M3 9h18M4 4h16v17H4z",
    chevron: "m6 9 6 6 6-6",
    layers: "m3 8 9-5 9 5-9 5-9-5m0 5 9 5 9-5m-18 5 9 5 9-5",
    locate: "M12 2v4m0 12v4M2 12h4m12 0h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.arrow} /></svg>;
}
export default function Home() {
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(false);
  const mapView = false;
  const [zoom, setZoom] = useState(1);
  const [profile, setProfile] = useState(false);
  const point = selected === null ? null : points[selected];
  const visiblePoint = point && (!filter || point.color === "red") && (!query || point.name.toLowerCase().includes(query.toLowerCase())) ? point : null;
  return <div className={`ruas-home ${dark ? "night" : ""} ${mapView ? "map-view" : ""}`}>
    <div className="scene" style={{ transform: `scale(${zoom})` }} />
    <header className="home-nav">
      <Link className="home-brand" href="/" aria-label="RuasKita beranda"><img src={dark ? "/brand/dark.png" : "/brand/light.png"} alt="" />RuasKita</Link>
      <nav aria-label="Navigasi utama">
        <button className="active" onClick={() => router.push("/")}>Beranda</button>
        <button onClick={() => router.push("/map")}>Peta</button>
        <button onClick={() => router.push("/reports")}>Laporan</button>
      </nav>
      <label className="home-search"><Icon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") router.push(`/incidents?road=${encodeURIComponent(query)}`); }} placeholder="Cari jalan, tekan Enter..." aria-label="Cari jalan" /></label>
      <div className="profile-wrap"><button className="profile-button" onClick={() => setProfile(!profile)} aria-expanded={profile}><span className="avatar" /><span>Workspace<small>Operator lokal</small></span><Icon name="chevron" /></button>
      {profile && <div className="profile-menu"><button onClick={() => router.push("/dashboard")}>Buka workspace ↗</button><button onClick={toggle}>{dark ? "☀ Tema terang" : "☾ Tema gelap"}</button></div>}</div>
    </header>
    {!mapView && <section className="home-copy">
      <p className="home-eyebrow">JALAN YANG LEBIH BAIK, BERSAMA.</p>
      <h1>Pantau Kondisi Jalan<br /><span>Bangun Masa Depan</span></h1>
      <p className="home-description">Kenali kondisi jalan. Tentukan langkah berikutnya.</p>
      <div className="hero-actions"><button className="primary-pill" onClick={() => router.push("/map")}>Buka Peta <Icon name="arrow" /></button></div>
    </section>}
    <section className="map-content" aria-label="Pratinjau peta kondisi jalan Yogyakarta">
      <span className="place sleman">Sleman</span><span className="place yogya">Yogyakarta</span><span className="place depok">Depok</span><span className="place bantul">Bantul</span>
      {points.map((p, i) => (!filter || p.color === "red") && (!query || p.name.toLowerCase().includes(query.toLowerCase())) && <button key={p.name} className={`map-dot ${p.color} ${selected === i ? "selected" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-label={p.name} onClick={() => setSelected(i)} />)}
      {visiblePoint && <button className="road-popover" style={{ left: `${Math.min(visiblePoint.x + 1.4, 76)}%`, top: `${visiblePoint.y - 9}%` }} onClick={() => router.push("/map")}>
        <span className="road-photo" /><span><strong>{visiblePoint.name}</strong><span className="condition"><i className={visiblePoint.color} />Ilustrasi kondisi</span><small>Buka peta laporan aktual</small></span><Icon name="arrow" />
      </button>}
      <div className="map-controls"><button aria-label="Filter kondisi kritis" aria-pressed={filter} onClick={() => setFilter(!filter)}><Icon name="layers" /></button><div><button aria-label="Perbesar" onClick={() => setZoom(Math.min(1.3, zoom + .1))}>+</button><button aria-label="Perkecil" onClick={() => setZoom(Math.max(1, zoom - .1))}>−</button></div><button aria-label="Kembali ke Yogyakarta" onClick={() => { setZoom(1); setSelected(0); setQuery(""); }}><Icon name="locate" /></button></div>
      <div className="map-scale"><span>0</span><span>2,5</span><span>5 km</span><div /></div>
    </section>
    <section className="bottom-cards">
      <article className="health-card"><div className="health-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" /><circle className="progress" cx="60" cy="60" r="54" /></svg><div><strong>72</strong><span>Ilustrasi skor</span></div></div><div className="health-copy"><p className="summary-location">WORKSPACE RUASKITA</p><h2>Jalan lebih baik, langkah lebih pasti.</h2><p>Buka ringkasan laporan dan tindak lanjut.</p></div><button className="summary-link" aria-label="Buka ringkasan workspace" onClick={() => router.push("/dashboard")}><Icon name="arrow" /></button></article>
    </section>
    <span className="demo-label">Pratinjau desain · data contoh</span>
  </div>;
}
