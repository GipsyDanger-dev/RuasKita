"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  dateLabel,
  detailURL,
  Incident,
  severityNames,
  statusNames,
} from "@/lib/workspace";
import styles from "./dashboard.module.css";

const RoadMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading} role="status">
      Menyiapkan peta…
    </div>
  ),
});

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} />
    </svg>
  );
}

export default function Dashboard({
  items,
  reload,
}: {
  items: Incident[];
  reload: () => void;
}) {
  const router = useRouter();
  const active = items.filter((item) => item.status !== "resolved");
  const urgent = active.filter((item) => item.severity === "high").length;
  const handling = items.filter((item) =>
    ["assigned", "in_repair", "recheck"].includes(item.status),
  ).length;
  const resolved = items.filter((item) => item.status === "resolved").length;
  const candidate = items.filter((item) => item.status === "candidate").length;
  const verified = items.filter((item) => item.status === "verified").length;
  const priority = [...active]
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 })[a.severity] -
          { high: 0, medium: 1, low: 2 }[b.severity] ||
        a.created_at.localeCompare(b.created_at),
    )
    .slice(0, 4);
  const completion = items.length
    ? Math.round((resolved / items.length) * 100)
    : null;
  const roadCount = new Set(
    items.map((item) => item.road.trim().toLocaleLowerCase("id-ID")),
  ).size;
  const latest = [...items].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  )[0];
  const metrics = [
    {
      label: "Insiden aktif",
      value: active.length,
      note: `${items.length} insiden tercatat`,
      href: "/incidents?active=true",
      tone: "active",
    },
    {
      label: "Perhatian tinggi",
      value: urgent,
      note: "Dari insiden yang aktif",
      href: "/incidents?severity=high&active=true",
      tone: "urgent",
    },
    {
      label: "Dalam penanganan",
      value: handling,
      note: "Ditugaskan & diperbaiki",
      href: "/repairs",
      tone: "handling",
    },
    {
      label: "Sudah selesai",
      value: resolved,
      note: "Perbaikan telah ditinjau",
      href: "/incidents?status=resolved",
      tone: "resolved",
    },
  ];
  return (
    <div className={styles.dashboard}>
      <div className={`rk-page-heading ${styles.heading}`}>
        <div>
          <p className={`rk-kicker ${styles.eyebrow}`}>
            <span /> PANTAU & TINDAK LANJUTI
          </p>
          <h1>
            Ringkasan jalan<span className={styles.fullStop}>.</span>
          </h1>
          <p>Kondisi terkini. Langkah berikutnya.</p>
        </div>
        <div className={styles.headingActions}>
          <button
            type="button"
            className={`rk-icon-button ${styles.refresh}`}
            onClick={reload}
            aria-label="Perbarui data"
            title="Perbarui data"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
            </svg>
          </button>
          <Link
            className={`rk-button ${styles.reportButton}`}
            href="/incidents/new"
          >
            + Laporkan kerusakan
          </Link>
        </div>
      </div>

      <section className={styles.metrics} aria-label="Ringkasan insiden">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className={styles.metric}>
            <span className={styles.metricLabel}>
              {metric.label}
              <Arrow diagonal />
            </span>
            <strong className={styles.metricValue} data-tone={metric.tone}>
              {metric.value.toLocaleString("id-ID")}
              <span className={styles.metricDot} />
            </strong>
            <span className={styles.metricNote}>{metric.note}</span>
          </Link>
        ))}
      </section>

      <div className={styles.workspace}>
        <section
          className={styles.mapSection}
          aria-labelledby="dashboard-map-heading"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>PETA WILAYAH</p>
              <h2 id="dashboard-map-heading">Lihat titiknya.</h2>
            </div>
            <Link className={styles.textLink} href="/map">
              Buka peta <Arrow diagonal />
            </Link>
          </div>
          <div className={styles.map}>
            <RoadMap
              items={items}
              onSelect={(id) =>
                router.push(`/map?id=${encodeURIComponent(id)}`)
              }
            />
          </div>
          <div className={styles.mapCaption}>
            <span>
              {items.length
                ? `${items.length} titik · ${roadCount} ruas jalan`
                : "Yogyakarta · Belum ada titik laporan"}
            </span>
            <span className={styles.legend}>
              <i /> Tinggi <i /> Sedang <i /> Rendah <i /> Selesai
            </span>
          </div>
        </section>

        <section
          className={styles.progress}
          aria-labelledby="dashboard-progress-heading"
        >
          <div className={styles.progressTop}>
            <span className={styles.sectionLabel}>TINDAK LANJUT</span>
            <span className={styles.progressTag}>PROGRES</span>
          </div>
          <h2 id="dashboard-progress-heading">
            Setiap laporan,
            <br />
            ada tindak lanjut.
          </h2>
          <div className={styles.completion}>
            <strong>
              {completion === null ? "—" : completion}
              <span>{completion === null ? "" : "%"}</span>
            </strong>
            <span>
              {completion === null ? "Belum ada progres" : "insiden selesai"}
            </span>
          </div>
          <div
            className={styles.progressTrack}
            role="meter"
            aria-label="Persentase insiden selesai"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion ?? 0}
            aria-valuetext={
              completion === null
                ? "Belum ada data"
                : `${completion}% insiden selesai`
            }
          >
            <span style={{ width: `${completion ?? 0}%` }} />
          </div>
          <dl className={styles.progressRows}>
            <div>
              <dt>Menunggu tinjauan</dt>
              <dd>{candidate}</dd>
            </div>
            <div>
              <dt>Siap ditugaskan</dt>
              <dd>{verified}</dd>
            </div>
            <div>
              <dt>Dalam penanganan</dt>
              <dd>{handling}</dd>
            </div>
          </dl>
          <Link href="/repairs" className={styles.progressLink}>
            Lihat alur perbaikan <Arrow />
          </Link>
        </section>
      </div>

      <section
        className={styles.priority}
        aria-labelledby="dashboard-priority-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionLabel}>DAFTAR PERHATIAN</p>
            <h2 id="dashboard-priority-heading">
              Perlu ditindaklanjuti{" "}
              <span className={styles.count}>{active.length}</span>
            </h2>
          </div>
          <Link className={styles.textLink} href="/incidents">
            Semua insiden <Arrow />
          </Link>
        </div>
        {priority.length ? (
          <ol className={styles.incidentList}>
            {priority.map((item, index) => (
              <li key={item.id}>
                <Link href={detailURL(item.id)} className={styles.incidentRow}>
                  <span className={styles.rowIndex}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className={styles.road}>
                    <strong>{item.road}</strong>
                    <span>
                      {item.observations.length} bukti ·{" "}
                      {dateLabel(item.updated_at)}
                    </span>
                  </div>
                  <span className={styles.severity} data-level={item.severity}>
                    Perhatian {severityNames[item.severity].toLowerCase()}
                  </span>
                  <span className={styles.status}>
                    {statusNames[item.status]}
                  </span>
                  <Arrow diagonal />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.empty}>
            <svg
              className={styles.emptyIcon}
              viewBox="0 0 48 48"
              width="48"
              height="48"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M14 7 9 41m25-34 5 34M24 9v7m0 6v7m0 6v5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <h3>
                {items.length
                  ? "Semua insiden sudah ditangani"
                  : "Belum ada insiden"}
              </h3>
              <p>
                {items.length
                  ? "Laporan baru yang perlu ditindaklanjuti akan muncul di sini."
                  : "Foto jalan pertama kamu jadi awal pemetaan yang lebih baik."}
              </p>
            </div>
            <Link
              className={styles.textLink}
              href={
                items.length ? "/incidents?status=resolved" : "/incidents/new"
              }
            >
              {items.length ? "Lihat hasil" : "Mulai laporan"} <Arrow />
            </Link>
          </div>
        )}
        <div className={styles.dataNote}>
          <span>
            {priority.length
              ? "Urutan berdasarkan tingkat perhatian pelapor dan usia laporan."
              : "Ringkasan dari laporan yang tersimpan."}
          </span>
          <span>
            {latest
              ? `Pembaruan terakhir · ${dateLabel(latest.updated_at)}`
              : "Menunggu laporan pertama"}
          </span>
        </div>
      </section>
    </div>
  );
}
