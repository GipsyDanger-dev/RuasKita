"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import PublicShell from "@/components/workspace/public-shell";
import { Badge, useResource } from "@/components/workspace/shared";
import { ReportList } from "@/components/workspace/report-list";
import { type Incident, detailURL } from "@/lib/workspace";
import "./home.css";

const RoadMap = dynamic(() => import("@/components/workspace/map"), {
  ssr: false,
  loading: () => <div className="rk-map-placeholder" role="status">Menyiapkan peta jalan…</div>,
});

export default function Home() {
  const router = useRouter();
  const { data, error, reload } = useResource<Incident[]>("/v1/incidents", 15000);
  const recent = [...(data ?? [])].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 3);
  const latest = recent[0];

  return <PublicShell>
    <section className="citizen-welcome" aria-labelledby="welcome-title">
      <div>
        <h1 id="welcome-title">Kabar jalan,<br />dari kita semua.</h1>
        <p>Ruang bersama untuk melihat dan melaporkan kondisi jalan.</p>
      </div>
      <form className="citizen-search" action="/map" role="search">
        <label htmlFor="road-search">Mau lihat jalan mana?</label>
        <div><input id="road-search" name="road" placeholder="Cari nama jalan" required /><button type="submit" aria-label="Cari jalan di peta"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg></button></div>
      </form>
    </section>

    <section className="citizen-explore" aria-label="Peta dan kontribusi warga">
      <div className="citizen-map">
        <div className="citizen-map-heading"><h2>Lihat kabar di jalan</h2><Link href="/map">Buka peta lengkap</Link></div>
        <RoadMap items={data ?? []} onSelect={(id) => router.push(detailURL(id))} />
        {latest && <Link className="citizen-map-report" href={detailURL(latest.id)}><span>Laporan terakhir</span><strong>{latest.road}</strong><Badge status={latest.status} /></Link>}
      </div>
      <aside className="citizen-contribute">
        <span className="citizen-contribute-label">Dari kita, untuk kita.</span>
        <h2>Ketemu jalan rusak?<br />Bagikan di sini.</h2>
        <p>Menemukan jalan rusak? Satu foto dan titik lokasi bisa membantu orang lain lebih waspada.</p>
        <Link className="citizen-report-button" href="/incidents/new">Laporkan kondisi jalan</Link>
        <div className="citizen-scan-link"><span>Ingin mencatat sepanjang rute?</span><Link href="/scan">Gunakan live scan</Link></div>
      </aside>
    </section>

    <section className="citizen-recent" aria-labelledby="recent-title">
      <div className="citizen-section-title"><div><h2 id="recent-title">Kabar dari jalan</h2><p>Laporan terbaru yang dibagikan masyarakat.</p></div><Link href="/incidents">Semua laporan</Link></div>
      {error ? <div className="citizen-data-state" role="alert"><p>Laporan belum bisa dimuat. Periksa koneksi lalu coba lagi.</p><button className="rk-button rk-secondary" onClick={reload}>Coba lagi</button></div>
        : !data ? <p className="citizen-data-state" role="status">Mengambil laporan terbaru…</p>
        : <ReportList items={recent} />}
    </section>
  </PublicShell>;
}
