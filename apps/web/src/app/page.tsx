"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/workspace/theme";
import "./home.css";

function Icon({ name }: { name: "arrow" | "sun" | "moon" }) {
  const paths = {
    arrow: "M4 12h16m-6-6 6 6-6 6",
    sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    moon: "M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z",
  };
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function Home() {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();

  return (
    <div className={`ruas-home${dark ? " night" : ""}`}>
      <a className="home-skip" href="#home-main">Lewati navigasi</a>
      <div className="home-scene" aria-hidden="true" />
      <header className="home-nav">
        <Link className="home-brand" href="/" aria-label="RuasKita, beranda">
          <img src={dark ? "/brand/dark.png" : "/brand/light.png"} alt="" />
          <span>RuasKita</span>
        </Link>
        <nav aria-label="Navigasi utama">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Beranda</Link>
          <Link href="/map">Peta jalan</Link>
          <Link href="/incidents" aria-current={pathname.startsWith("/incidents") ? "page" : undefined}>Laporan</Link>
        </nav>
        <div className="home-tools">
          <Link className="header-report" href="/incidents/new">Laporkan jalan</Link>
          <button className="theme-toggle" type="button" onClick={toggle} aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"}>
            <Icon name={dark ? "sun" : "moon"} />
          </button>
        </div>
      </header>

      <main id="home-main" className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <h1 id="home-title">Lihat kondisi jalan<br />di sekitarmu.</h1>
          <p className="home-description">Temukan laporan di peta atau bagikan kondisi jalan yang kamu temui. Sertakan lokasi agar titiknya mudah diperiksa.</p>
          <div className="hero-actions">
            <Link className="primary-action" href="/incidents/new">Laporkan jalan <Icon name="arrow" /></Link>
            <Link className="secondary-action" href="/map">Buka peta</Link>
          </div>
        </div>
        <div className="map-caption">
          <span>Ilustrasi kawasan Yogyakarta</span>
          <Link href="/map">Laporan terbaru di peta <Icon name="arrow" /></Link>
        </div>
      </main>

      <footer className="home-footer"><span>RuasKita · informasi jalan untuk semua.</span><span>Laporan adalah informasi awal dan perlu diperiksa.</span></footer>
    </div>
  );
}
