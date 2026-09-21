"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTheme } from "./theme";
import "./workspace.css";
import "./shell.css";

type IconName =
  | "dashboard"
  | "map"
  | "roads"
  | "incidents"
  | "repairs"
  | "ruasview"
  | "analytics"
  | "reports"
  | "contributors"
  | "system"
  | "menu"
  | "close"
  | "sun"
  | "moon";

type NavLink = { url: string; label: string; icon: IconName };
type NavGroup = { label: string; links: readonly NavLink[] };

const navGroups: readonly NavGroup[] = [
  {
    label: "PANTAU",
    links: [
      { url: "dashboard", label: "Ringkasan", icon: "dashboard" },
      { url: "map", label: "Peta", icon: "map" },
      { url: "roads", label: "Ruas Jalan", icon: "roads" },
    ],
  },
  {
    label: "TINDAK LANJUT",
    links: [
      { url: "incidents", label: "Insiden", icon: "incidents" },
      { url: "repairs", label: "Perbaikan", icon: "repairs" },
    ],
  },
  {
    label: "BUKTI & LAPORAN",
    links: [
      { url: "ruasview", label: "RuasView", icon: "ruasview" },
      { url: "analytics", label: "Analitik", icon: "analytics" },
      { url: "reports", label: "Laporan", icon: "reports" },
    ],
  },
  {
    label: "RUANG KERJA",
    links: [
      { url: "contributors", label: "Kontributor", icon: "contributors" },
      { url: "system", label: "Sistem", icon: "system" },
    ],
  },
];

function NavIcon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const content = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    map: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    roads: (
      <>
        <path d="M5 20c5-2 5-6 5-9s1-5 4-7" />
        <path d="M14 4h5v5" />
        <path d="M8 16h.01M10 11h.01M13 7h.01" />
      </>
    ),
    incidents: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v5M12 16h.01" />
      </>
    ),
    repairs: (
      <>
        <path d="m5 19 10-10" />
        <path d="M14 5h5v5" />
        <path d="M5 5h4M5 9h2" />
      </>
    ),
    ruasview: (
      <>
        <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 19V5M4 19h16" />
        <path d="m8 16 3-4 3 2 5-7" />
      </>
    ),
    reports: (
      <>
        <path d="M6 3.5h9l3 3V20.5H6z" />
        <path d="M15 3.5v3h3M9 11h6M9 15h6" />
      </>
    ),
    contributors: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.5-3 2.4-5 5.5-5s5 2 5.5 5M16 5.5a3 3 0 0 1 0 5.7M16 14c2.4.2 3.9 1.8 4.5 4" />
      </>
    ),
    system: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.4 1.4-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.4-1.4.1-.1A1.7 1.7 0 0 0 9.4 15a1.7 1.7 0 0 0-1.6-1H7.6v-2h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L9 9l1.4-1.4.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L20 9l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2h-.2a1.7 1.7 0 0 0-1.8 1Z" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </>
    ),
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
  }[name];
  return <svg {...common}>{content}</svg>;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const menu = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1100px)");
    const closeOnDesktop = () => {
      if (desktop.matches) menu.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const active = navGroups
    .flatMap(({ links }) => links)
    .find(({ url }) => pathname.startsWith(`/${url}`));
  const brand = (
    <Link href="/" className="rk-brand">
      <img
        width="44"
        height="44"
        src={dark ? "/brand/dark.png" : "/brand/light.png"}
        alt=""
      />
      <span className="rk-brand-copy">
        <strong>
          RuasKita<span>.</span>
        </strong>
        <small>Road intelligence</small>
      </span>
    </Link>
  );
  const navigation = (mobile = false) => (
    <nav aria-label={mobile ? "Navigasi mobile" : "Navigasi workspace"}>
      {navGroups.map((group) => (
        <div className="rk-nav-group" key={group.label}>
          <p className="rk-nav-label">{group.label}</p>
          {group.links.map(({ url, label, icon }) => (
            <Link
              href={`/${url}`}
              key={url}
              className={active?.url === url ? "is-active" : ""}
              aria-current={active?.url === url ? "page" : undefined}
              onClick={() => menu.current?.close()}
            >
              <NavIcon name={icon} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
  return (
    <div className={`rk-app ${dark ? "rk-dark" : ""}`}>
      <a className="rk-skip" href="#workspace-main">
        Lewati navigasi
      </a>
      <aside className="rk-sidebar">
        <div className="rk-sidebar-head">
          {brand}
          <button
            ref={menuButton}
            className="rk-mobile-menu"
            type="button"
            aria-haspopup="dialog"
            aria-controls="workspace-menu"
            onClick={() => menu.current?.showModal()}
          >
            <NavIcon name="menu" />
            <span>Menu</span>
          </button>
        </div>
        {navigation()}
        <div className="rk-sidebar-bottom">
          <Link href="/system">
            <span className="rk-avatar">LK</span>
            <span>
              Operator lokal<small>Pengaturan workspace</small>
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </aside>
      <dialog
        ref={menu}
        id="workspace-menu"
        className="rk-menu-dialog"
        aria-label="Menu RuasKita"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            "a[href], button:not(:disabled)",
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClose={() => menuButton.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) menu.current?.close();
        }}
      >
        <div className="rk-menu-content">
          <div className="rk-menu-heading">
            <strong>Jelajahi RuasKita</strong>
            <button
              type="button"
              className="rk-icon-button"
              aria-label="Tutup menu"
              onClick={() => menu.current?.close()}
            >
              <NavIcon name="close" />
            </button>
          </div>
          {navigation(true)}
        </div>
      </dialog>
      <div className="rk-body">
        <header className="rk-topbar">
          <span>
            <span className="rk-breadcrumb-root">
              Workspace <span className="rk-slash">/</span>
            </span>{" "}
            <strong>{active?.label}</strong>
          </span>
          <div>
            <span className="rk-workspace-mode">Workspace lokal</span>
            <button
              type="button"
              className="rk-icon-button"
              onClick={toggle}
              aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"}
            >
              <NavIcon name={dark ? "sun" : "moon"} />
            </button>
            <Link
              className="rk-local-profile"
              href="/system"
              aria-label="Pengaturan operator lokal"
            >
              <span className="rk-avatar">LK</span>
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
