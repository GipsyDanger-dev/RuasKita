"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme";
import "./workspace.css";
import "./shell.css";
import "./public-shell.css";

function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5a8.5 8.5 0 1 0 12 12Z" /></svg>
  );
}

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const reportActive = pathname.startsWith("/incidents") && pathname !== "/incidents/new";

  return (
    <div className={`rk-app rk-public-root${dark ? " rk-dark" : ""}`} data-page={pathname === "/" ? "home" : pathname.split("/")[1]}>
      <a className="rk-public-skip" href="#public-main">Lewati navigasi</a>
      <header className="rk-public-header">
        <Link className="rk-public-brand" href="/" aria-label="RuasKita, beranda">
          <img src={dark ? "/brand/dark.png" : "/brand/light.png"} alt="" />
          <span>RuasKita</span>
        </Link>
        <nav aria-label="Navigasi utama">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Beranda</Link>
          <Link href="/map" aria-current={pathname === "/map" ? "page" : undefined}>Peta jalan</Link>
          <Link href="/incidents" aria-current={reportActive ? "page" : undefined}>Laporan</Link>
          <Link href="/scan" aria-current={pathname === "/scan" ? "page" : undefined}>Live scan</Link>
        </nav>
        <div className="rk-public-tools">
          <button className="rk-public-theme" type="button" onClick={toggle} aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"}>
            <ThemeIcon dark={dark} />
          </button>
          <Link className="rk-public-report" href="/incidents/new" aria-current={pathname === "/incidents/new" ? "page" : undefined}><span aria-hidden="true">+</span> Buat laporan</Link>
        </div>
      </header>
      <div className="rk-public-body">
        <main id="public-main" className="rk-main rk-public-main" tabIndex={-1}>{children}</main>
        <footer className="rk-public-footer">
          <Link href="/">RuasKita <span>Jalan kita, tanggung jawab bersama.</span></Link>
          <span>Informasi dari masyarakat. Bukan jaminan kondisi jalan.</span>
        </footer>
      </div>
    </div>
  );
}
