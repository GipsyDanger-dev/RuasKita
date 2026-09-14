"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme";
import "./workspace.css";

const links = [
  ["dashboard", "Ringkasan", "◫"],
  ["map", "Peta", "⌖"],
  ["roads", "Ruas Jalan", "↝"],
  ["incidents", "Insiden", "◎"],
  ["repairs", "Perbaikan", "↗"],
  ["ruasview", "RuasView", "▣"],
  ["analytics", "Analitik", "▥"],
  ["reports", "Laporan", "▤"],
  ["contributors", "Kontributor", "♧"],
  ["system", "Sistem", "⚙"],
];
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const active = links.find(([url]) => pathname.startsWith(`/${url}`));
  return (
    <div className={`rk-app ${dark ? "rk-dark" : ""}`}>
      <a className="rk-skip" href="#workspace-main">
        Lewati navigasi
      </a>
      <aside className="rk-sidebar">
        <Link href="/" className="rk-brand">
          <img src={dark ? "/brand/dark.png" : "/brand/light.png"} alt="" />
          RuasKita<span>ROAD INTELLIGENCE</span>
        </Link>
        <p className="rk-nav-label">WORKSPACE</p>
        <nav aria-label="Navigasi workspace">
          {links.map(([url, label, icon]) => (
            <Link
              href={`/${url}`}
              key={url}
              className={active?.[0] === url ? "is-active" : ""}
              aria-current={active?.[0] === url ? "page" : undefined}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="rk-sidebar-bottom">
          <span className="rk-online-dot" /> Workspace lokal
          <small>Data tersimpan di perangkat server.</small>
          <Link href="/">← Kembali ke beranda</Link>
        </div>
      </aside>
      <div className="rk-body">
        <header className="rk-topbar">
          <span>
            Workspace <span className="rk-slash">/</span>{" "}
            <strong>{active?.[1]}</strong>
          </span>
          <div>
            <button
              className="rk-icon-button"
              onClick={toggle}
              aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"}
            >
              {dark ? "☀" : "☾"}
            </button>
            <Link className="rk-local-profile" href="/system">
              <span>LK</span>
              <div>
                Operator lokal<small>Belum menggunakan akun</small>
              </div>
            </Link>
          </div>
        </header>
        <main id="workspace-main" className="rk-main" tabIndex={-1}>
          {children}
        </main>
        <footer className="rk-footer">
          RuasKita · Desktop workspace{" "}
          <span>Penilaian awal, bukan verifikasi lapangan.</span>
        </footer>
      </div>
    </div>
  );
}
