"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/components/workspace/theme";
import "./home.css";

function Icon({ name }: { name: "search" | "arrow" | "sun" | "moon" }) {
  const paths = {
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    moon: "M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z",
  };
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const [query, setQuery] = useState("");
  const submitSearch = () => {
    const value = query.trim();
    router.push(value ? `/incidents?road=${encodeURIComponent(value)}` : "/map");
  };

  return (
    <main className={`ruas-home${dark ? " night" : ""}`}>
      <div className="home-scene" aria-hidden="true" />
      <header className="home-nav">
        <Link className="home-brand" href="/" aria-label="RuasKita, beranda">
          <img src={dark ? "/brand/dark.png" : "/brand/light.png"} alt="" />
          <span>RuasKita</span>
        </Link>
        <nav aria-label="Navigasi utama">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Beranda</Link>
          <Link href="/map">Peta jalan</Link>
          <Link href="/incidents">Laporan warga</Link>
        </nav>
        <form className="home-search" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
          <Icon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama jalan" aria-label="Cari laporan berdasarkan nama jalan" />
          <button type="submit">Cari</button>
        </form>
        <div className="home-tools">
          <button className="theme-toggle" type="button" onClick={toggle} aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"}>
            <Icon name={dark ? "sun" : "moon"} />
          </button>
          <Link className="staff-link" href="/dashboard">Ruang petugas</Link>
        </div>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="home-kicker">Informasi jalan, dari warga untuk semua</p>
          <h1 id="home-title">Jalan rusak?<br />Bantu kami <span>mengetahuinya.</span></h1>
          <p className="home-description">Temukan kondisi jalan di sekitarmu, kirim laporan dengan lokasi, lalu ikuti perkembangannya.</p>
          <div className="hero-actions">
            <Link className="primary-action" href="/incidents/new">Laporkan kondisi jalan <Icon name="arrow" /></Link>
            <Link className="secondary-action" href="/map">Lihat peta jalan</Link>
          </div>
          <p className="home-note">Tidak perlu akun untuk mulai melihat laporan.</p>
        </div>
        <div className="map-caption">
          <span className="caption-mark" aria-hidden="true" />
          <span>Yogyakarta dan sekitarnya</span>
          <Link href="/map">Buka peta <Icon name="arrow" /></Link>
        </div>
      </section>

      <section className="home-next" aria-label="Hal yang bisa dilakukan di RuasKita">
        <Link href="/map"><span className="next-index">01</span><span><strong>Lihat kondisi jalan</strong><small>Jelajahi laporan di peta.</small></span><Icon name="arrow" /></Link>
        <Link href="/incidents/new"><span className="next-index">02</span><span><strong>Kirim laporan</strong><small>Bagikan lokasi dan bukti foto.</small></span><Icon name="arrow" /></Link>
        <Link href="/incidents"><span className="next-index">03</span><span><strong>Pantau tindak lanjut</strong><small>Lihat pembaruan dari laporan warga.</small></span><Icon name="arrow" /></Link>
      </section>
      <footer className="home-footer"><span>RuasKita</span><span>Penilaian awal berdasarkan laporan warga; kondisi perlu diverifikasi.</span></footer>
    </main>
  );
}
