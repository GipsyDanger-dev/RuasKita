"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  API,
  dateLabel,
  detailURL,
  downloadJSON,
  Incident,
  severityNames,
  shortId,
  statusNames,
  Status,
} from "@/lib/workspace";
import {
  Badge,
  Empty,
  IncidentTable,
  LoadState,
  PageTitle,
  useResource,
} from "./shared";
import { NewIncident, IncidentDetail } from "./incident-editor";
import { ReportsPage, ReportDetail } from "./reports";
import { EvidenceImage } from "./evidence";
const RoadMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <div className="rk-map-placeholder">Menyiapkan peta…</div>,
});
const newReport = (
  <Link className="rk-button" href="/incidents/new">
    + Laporkan kerusakan
  </Link>
);
type Filter = Record<string, string>;

export default function WorkspacePage({
  section,
  id,
  filter,
}: {
  section: string;
  id?: string;
  filter: Filter;
}) {
  if (section === "incidents" && id === "new") return <NewIncident />;
  if (section === "incidents" && id) return <IncidentDetail id={id} />;
  if (section === "reports")
    return id ? <ReportDetail id={id} /> : <ReportsPage />;
  if (section === "system") return <SystemPage />;
  return (
    <DataPages
      key={`${section}-${JSON.stringify(filter)}`}
      section={section}
      filter={filter}
    />
  );
}
function DataPages({ section, filter }: { section: string; filter: Filter }) {
  const resource = useResource<Incident[]>("/v1/incidents");
  if (!resource.data) return <LoadState {...resource} />;
  const items = resource.data;
  switch (section) {
    case "dashboard":
      return <Overview items={items} reload={resource.reload} />;
    case "incidents":
      return <Incidents items={items} filter={filter} />;
    case "map":
      return <MapPage items={items} filter={filter} reload={resource.reload} />;
    case "roads":
      return <Roads items={items} />;
    case "repairs":
      return <Repairs items={items} />;
    case "ruasview":
      return <RuasView items={items} filter={filter} />;
    case "analytics":
      return <Analytics items={items} />;
    case "contributors":
      return <Contributors items={items} />;
    default:
      return null;
  }
}
function Metrics({ items }: { items: Incident[] }) {
  return (
    <div className="rk-metrics">
      <div>
        <span>Insiden aktif</span>
        <strong>{items.filter((i) => i.status !== "resolved").length}</strong>
        <small>Dari {items.length} insiden tercatat</small>
      </div>
      <div>
        <span>Perlu perhatian tinggi</span>
        <strong>
          {
            items.filter(
              (i) => i.severity === "high" && i.status !== "resolved",
            ).length
          }
          <i className="rk-metric-dot" />
        </strong>
        <small>Penilaian awal pelapor</small>
      </div>
      <div>
        <span>Dalam penanganan</span>
        <strong>
          {
            items.filter((i) =>
              ["assigned", "in_repair", "recheck"].includes(i.status),
            ).length
          }
        </strong>
        <small>Ditugaskan hingga diperiksa ulang</small>
      </div>
      <div>
        <span>Selesai</span>
        <strong>{items.filter((i) => i.status === "resolved").length}</strong>
        <small>Berdasarkan tinjauan lokal</small>
      </div>
    </div>
  );
}
function Overview({
  items,
  reload,
}: {
  items: Incident[];
  reload: () => void;
}) {
  const priority = [...items]
    .filter((i) => i.status !== "resolved")
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 })[a.severity] -
          { high: 0, medium: 1, low: 2 }[b.severity] ||
        a.created_at.localeCompare(b.created_at),
    )
    .slice(0, 5);
  return (
    <>
      <PageTitle
        eyebrow="KONDISI JALAN"
        title="Ringkasan kondisi jalan"
        description="Lihat prioritas laporan dan tindak lanjut yang tersimpan di workspace ini."
        action={
          <div className="rk-heading-actions">
            {newReport}
            <button className="rk-button rk-secondary" onClick={reload}>
              Perbarui data
            </button>
          </div>
        }
      />
      <Metrics items={items} />
      {!items.length ? (
        <Empty />
      ) : (
        <>
          <div className="rk-section-title">
            <div>
              <p className="rk-kicker">FOKUS HARI INI</p>
              <h2>Perlu ditindaklanjuti</h2>
            </div>
            <Link href="/incidents">Semua insiden ↗</Link>
          </div>
          <p className="rk-helper">
            Urutan berdasarkan perhatian manual, lalu usia laporan. Belum
            menggunakan Priority Engine.
          </p>
          <IncidentTable items={priority} />
        </>
      )}
    </>
  );
}
function Incidents({ items, filter }: { items: Incident[]; filter: Filter }) {
  const [query, setQuery] = useState(filter.road || "");
  const [status, setStatus] = useState(filter.status || "");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const shown = items.filter(
    (i) =>
      (!status || i.status === status) &&
      (!severity || i.severity === severity) &&
      (!filter.contributor ||
        i.observations.some((o) => o.contributor === filter.contributor)) &&
      `${i.road} ${i.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  function reset() {
    setQuery("");
    setStatus("");
    setSeverity("");
    setPage(1);
  }
  return (
    <>
      <PageTitle
        eyebrow="INSIDEN JALAN"
        title="Bukti menjadi tindakan."
        description={
          filter.contributor
            ? `Observasi oleh ${filter.contributor}`
            : "Kelola temuan, telusuri bukti, dan ikuti perkembangannya."
        }
        action={newReport}
      />
      <div className="rk-toolbar">
        <label className="rk-search-field">
          <span className="rk-sr">Cari insiden</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari ruas atau ID insiden…"
          />
        </label>
        <label className="rk-inline-field">
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua</option>
            {Object.entries(statusNames).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="rk-inline-field">
          Perhatian
          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua</option>
            {Object.entries(severityNames).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button className="rk-text-button" onClick={reset}>
          Reset filter
        </button>
      </div>
      {!items.length ? (
        <Empty />
      ) : (
        <>
          <IncidentTable items={shown.slice((page - 1) * 10, page * 10)} />
          <div className="rk-pagination">
            <span>{shown.length} insiden</span>
            <div>
              <button
                className="rk-icon-button"
                aria-label="Halaman sebelumnya"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                ←
              </button>
              <span>
                {page} / {Math.max(1, Math.ceil(shown.length / 10))}
              </span>
              <button
                className="rk-icon-button"
                aria-label="Halaman berikutnya"
                disabled={page * 10 >= shown.length}
                onClick={() => setPage(page + 1)}
              >
                →
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
function MapPage({
  items,
  filter,
  reload,
}: {
  items: Incident[];
  filter: Filter;
  reload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(filter.id || "");
  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          i.road.toLowerCase().includes(query.toLowerCase()) &&
          (!status ||
            (status === "active"
              ? i.status !== "resolved"
              : i.status === status)),
      ),
    [items, query, status],
  );
  const chosen = shown.find((i) => i.id === selected);
  return (
    <>
      <PageTitle
        eyebrow="PETA KONDISI JALAN"
        title="Lihat konteksnya."
        description="Titik berasal dari koordinat laporan tersimpan, bukan posisi dekoratif."
        action={newReport}
      />
      <div className="rk-map-workspace">
        <aside className="rk-map-list">
          <label className="rk-field">
            Cari ruas
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nama jalan…"
            />
          </label>
          <label className="rk-field">
            Tampilkan
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua insiden</option>
              <option value="active">Insiden aktif</option>
              <option value="resolved">Selesai</option>
              <option value="recheck">Periksa ulang</option>
            </select>
          </label>
          <p className="rk-helper">
            {shown.length} titik ·{" "}
            <button className="rk-text-button" onClick={reload}>
              Perbarui
            </button>
          </p>
          <div className="rk-map-results">
            {shown.map((i) => (
              <button
                key={i.id}
                className={i.id === selected ? "selected" : ""}
                onClick={() => setSelected(i.id)}
              >
                <strong>{i.road}</strong>
                <Badge status={i.status} />
                <small>
                  {i.latitude.toFixed(5)}, {i.longitude.toFixed(5)}
                </small>
              </button>
            ))}
            {!shown.length && (
              <p className="rk-muted">Tidak ada titik untuk filter ini.</p>
            )}
          </div>
        </aside>
        <section className="rk-map-canvas">
          <RoadMap items={shown} selected={selected} onSelect={setSelected} />
          {chosen && (
            <div className="rk-map-detail">
              <div>
                <Badge status={chosen.status} />
                <h2>{chosen.road}</h2>
                <p>
                  {chosen.observations.length} bukti · perhatian{" "}
                  {severityNames[chosen.severity].toLowerCase()}
                </p>
              </div>
              <Link className="rk-button" href={detailURL(chosen.id)}>
                Detail ↗
              </Link>
            </div>
          )}
        </section>
      </div>
      <p className="rk-helper">
        Lokasi dipilih pelapor. Road matching, GeoFusion, dan pembaruan realtime
        belum diaktifkan.
      </p>
    </>
  );
}
function Roads({ items }: { items: Incident[] }) {
  const [query, setQuery] = useState("");
  const roads = [...new Set(items.map((i) => i.road))]
    .filter((r) => r.toLowerCase().includes(query.toLowerCase()))
    .sort();
  return (
    <>
      <PageTitle
        eyebrow="JARINGAN JALAN"
        title="Kenali setiap ruas."
        description="Ruas dikelompokkan berdasarkan nama yang diisi pelapor."
        action={
          <Link className="rk-button rk-secondary" href="/map">
            Lihat peta ↗
          </Link>
        }
      />
      <div className="rk-toolbar">
        <label className="rk-search-field">
          <span className="rk-sr">Cari ruas jalan</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari ruas jalan…"
          />
        </label>
        <span className="rk-muted">{roads.length} ruas tercatat</span>
      </div>
      {!roads.length ? (
        <Empty title="Belum ada ruas yang cocok" />
      ) : (
        <div className="rk-road-list">
          {roads.map((road) => {
            const group = items.filter((i) => i.road === road);
            const active = group.filter((i) => i.status !== "resolved").length;
            return (
              <Link
                href={`/incidents?road=${encodeURIComponent(road)}`}
                key={road}
              >
                <span className="rk-road-index" aria-hidden="true">
                  ↝
                </span>
                <div>
                  <h2>{road}</h2>
                  <p>
                    {group.length} insiden ·{" "}
                    {group.reduce((sum, i) => sum + i.observations.length, 0)}{" "}
                    bukti observasi
                  </p>
                </div>
                <span className="rk-road-count">
                  {active}
                  <small>aktif</small>
                </span>
                <span aria-hidden="true">↗</span>
              </Link>
            );
          })}
        </div>
      )}
      <p className="rk-helper">
        Road Health Score belum ditampilkan karena data panjang ruas, cakupan,
        dan kalibrasi belum tersedia. Jumlah laporan bukan ukuran kesehatan
        jalan.
      </p>
    </>
  );
}
function Repairs({ items }: { items: Incident[] }) {
  const [query, setQuery] = useState("");
  const [includeResolved, setIncludeResolved] = useState(false);
  const stages: Status[] = includeResolved
    ? ["verified", "assigned", "in_repair", "recheck", "resolved"]
    : ["verified", "assigned", "in_repair", "recheck"];
  return (
    <>
      <PageTitle
        eyebrow="TINDAK LANJUT"
        title="Dari temuan ke perbaikan."
        description="Pilih insiden untuk mencatat tindakan. Setiap langkah memiliki jejak perubahan."
        action={
          <Link
            className="rk-button rk-secondary"
            href="/incidents?status=candidate"
          >
            Tinjau kandidat ↗
          </Link>
        }
      />
      <div className="rk-toolbar">
        <label className="rk-search-field">
          <span className="rk-sr">Cari perbaikan</span>
          <input
            placeholder="Cari jalan atau penanggung jawab…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="rk-check">
          <input
            type="checkbox"
            checked={includeResolved}
            onChange={(e) => setIncludeResolved(e.target.checked)}
          />
          Tampilkan selesai
        </label>
      </div>
      <div className="rk-repair-board">
        {stages.map((stage) => {
          const group = items.filter(
            (i) =>
              i.status === stage &&
              `${i.road} ${i.assignee}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          );
          return (
            <section key={stage}>
              <header>
                <h2>{statusNames[stage]}</h2>
                <span>{group.length}</span>
              </header>
              {group.map((i) => (
                <Link
                  className="rk-repair-item"
                  href={detailURL(i.id)}
                  key={i.id}
                >
                  <small>{shortId(i.id)}</small>
                  <h3>{i.road}</h3>
                  <span className={`rk-severity ${i.severity}`}>
                    Perhatian {severityNames[i.severity].toLowerCase()}
                  </span>
                  <p>{i.assignee || "Belum ditugaskan"}</p>
                  <span className="rk-repair-open">Tindak lanjuti ↗</span>
                </Link>
              ))}
              {!group.length && (
                <p className="rk-column-empty">Belum ada insiden</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
function RuasView({ items, filter }: { items: Incident[]; filter: Filter }) {
  const [selected, setSelected] = useState(filter.id || items[0]?.id || "");
  const [index, setIndex] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [compare, setCompare] = useState(false);
  const item = items.find((i) => i.id === selected);
  const photos = item?.observations ?? [];
  const photo = photos[index];
  const mapped = useMemo(
    () => items.filter((i) => i.id === selected),
    [items, selected],
  );
  return (
    <>
      <PageTitle
        eyebrow="RUASVIEW / BUKTI HISTORIS"
        title="Lihat perubahan, bukan asumsi."
        description="Jelajahi foto observasi yang tersimpan pada setiap insiden."
      />
      <div className="rk-toolbar">
        <label className="rk-inline-field">
          Insiden
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setIndex(0);
            }}
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.road} · {shortId(i.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="rk-check">
          <input
            type="checkbox"
            checked={overlay}
            onChange={(e) => setOverlay(e.target.checked)}
          />
          Overlay AI
        </label>
        <label className="rk-check">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            disabled={photos.length < 2}
          />
          Bandingkan awal / terbaru
        </label>
      </div>
      {!photo || !item ? (
        <Empty
          title="Belum ada imagery"
          description="Foto dari laporan dan observasi akan membentuk riwayat visual di sini."
        />
      ) : (
        <>
          <div className={compare ? "rk-compare" : "rk-viewer-layout"}>
            {compare ? (
              <>
                {[photos[0], photos[photos.length - 1]].map((p, i) => (
                  <figure key={i}>
                    <EvidenceImage
                      id={p.evidence_id}
                      analysis={p.analysis}
                      overlay={overlay}
                    />
                    <figcaption>
                      {i === 0 ? "Awal" : "Terbaru"} ·{" "}
                      {dateLabel(p.recorded_at)}
                      <p>{p.notes}</p>
                    </figcaption>
                  </figure>
                ))}
              </>
            ) : (
              <>
                <section>
                  <EvidenceImage
                    id={photo.evidence_id}
                    analysis={photo.analysis}
                    overlay={overlay}
                  />
                  <p className="rk-note">{photo.notes}</p>
                </section>
                <aside className="rk-viewer-context">
                  <div className="rk-mini-map">
                    <RoadMap items={mapped} selected={item.id} />
                  </div>
                  <h2>{item.road}</h2>
                  <Badge status={item.status} />
                  <p className="rk-muted">
                    {dateLabel(photo.recorded_at)}
                    <br />
                    Oleh {photo.contributor}
                  </p>
                  <Link
                    className="rk-button rk-secondary"
                    href={detailURL(item.id)}
                  >
                    Detail insiden ↗
                  </Link>
                </aside>
              </>
            )}
          </div>
          <div className="rk-viewer-timeline">
            <button
              className="rk-icon-button"
              aria-label="Observasi sebelumnya"
              disabled={index === 0 || compare}
              onClick={() => setIndex(index - 1)}
            >
              ←
            </button>
            <label className="rk-field">
              Observasi {index + 1} dari {photos.length}
              <input
                aria-label="Pilih observasi"
                type="range"
                min={0}
                max={photos.length - 1}
                value={index}
                disabled={compare || photos.length < 2}
                onChange={(e) => setIndex(+e.target.value)}
              />
            </label>
            <button
              className="rk-icon-button"
              aria-label="Observasi berikutnya"
              disabled={index === photos.length - 1 || compare}
              onClick={() => setIndex(index + 1)}
            >
              →
            </button>
          </div>
        </>
      )}
      <p className="rk-helper">
        Ini viewer bukti per insiden, belum street-level capture sepanjang ruas.
        Perbandingan visual tidak otomatis menyatakan kerusakan membaik atau
        memburuk.
      </p>
    </>
  );
}
function Analytics({ items }: { items: Incident[] }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const invalid = !!start && !!end && start > end;
  const shown = invalid
    ? []
    : items.filter(
        (i) =>
          (!start || i.created_at.slice(0, 10) >= start) &&
          (!end || i.created_at.slice(0, 10) <= end),
      );
  return (
    <>
      <PageTitle
        eyebrow="ANALITIK"
        title="Pahami yang sudah tercatat."
        description="Ringkasan dihitung dari data tersimpan, bukan angka ilustrasi."
        action={
          <button
            className="rk-button rk-secondary"
            disabled={!shown.length || invalid}
            onClick={() =>
              downloadJSON(
                { start, end, incidents: shown },
                "ruaskita-analytics.json",
              )
            }
          >
            Ekspor data ↗
          </button>
        }
      />
      <div className="rk-toolbar">
        <label className="rk-inline-field">
          Dari
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="rk-inline-field">
          Sampai
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <button
          className="rk-text-button"
          onClick={() => {
            setStart("");
            setEnd("");
          }}
        >
          Semua waktu
        </button>
      </div>
      {invalid && (
        <p className="rk-error" role="alert">
          Tanggal akhir harus setelah tanggal awal.
        </p>
      )}
      <Metrics items={shown} />
      {!shown.length ? (
        <Empty title="Belum ada data pada periode ini" action={false} />
      ) : (
        <div className="rk-analytics-grid">
          <section>
            <h2>Distribusi status</h2>
            <p className="rk-muted">Jumlah insiden pada setiap tahap.</p>
            {Object.entries(statusNames).map(([key, label]) => {
              const count = shown.filter((i) => i.status === key).length;
              return (
                <div className="rk-bar-row" key={key}>
                  <span>{label}</span>
                  <div>
                    <i style={{ width: `${(100 * count) / shown.length}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </section>
          <section>
            <h2>Perhatian awal</h2>
            <p className="rk-muted">Penilaian manual yang perlu ditinjau.</p>
            {Object.entries(severityNames).map(([key, label]) => {
              const count = shown.filter((i) => i.severity === key).length;
              return (
                <div className="rk-bar-row" key={key}>
                  <span>{label}</span>
                  <div>
                    <i style={{ width: `${(100 * count) / shown.length}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              );
            })}
            <p className="rk-helper">
              {new Set(shown.map((i) => i.road)).size} ruas bernama ·{" "}
              {shown.reduce((sum, i) => sum + i.observations.length, 0)} foto
              bukti
            </p>
          </section>
        </div>
      )}
      <p className="rk-helper">
        Periode mengikuti tanggal pembuatan insiden (UTC). Data pelaporan belum
        merepresentasikan seluruh jaringan jalan.
      </p>
    </>
  );
}
function Contributors({ items }: { items: Incident[] }) {
  const [query, setQuery] = useState("");
  const names = [
    ...new Set(items.flatMap((i) => i.observations.map((o) => o.contributor))),
  ]
    .filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    .sort();
  return (
    <>
      <PageTitle
        eyebrow="KONTRIBUTOR"
        title="Setiap bukti punya peran."
        description="Telusuri kontribusi dari nama yang dicatat pada observasi."
      />
      <div className="rk-toolbar">
        <label className="rk-search-field">
          <span className="rk-sr">Cari kontributor</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama kontributor…"
          />
        </label>
      </div>
      {!names.length ? (
        <Empty title="Belum ada kontributor yang cocok" action={false} />
      ) : (
        <div className="rk-table-wrap">
          <table className="rk-table">
            <thead>
              <tr>
                <th>Nama tercatat</th>
                <th>Observasi</th>
                <th>Insiden</th>
                <th>Kontribusi terbaru</th>
                <th>
                  <span className="rk-sr">Detail</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {names.map((name) => {
                const observations = items
                  .flatMap((i) => i.observations)
                  .filter((o) => o.contributor === name);
                return (
                  <tr key={name}>
                    <td>
                      <Link
                        className="rk-road-link"
                        href={`/incidents?contributor=${encodeURIComponent(name)}`}
                      >
                        {name}
                      </Link>
                      <small>Identitas belum diverifikasi</small>
                    </td>
                    <td>{observations.length}</td>
                    <td>
                      {
                        items.filter((i) =>
                          i.observations.some((o) => o.contributor === name),
                        ).length
                      }
                    </td>
                    <td>
                      {dateLabel(
                        observations
                          .map((o) => o.recorded_at)
                          .sort()
                          .at(-1)!,
                      )}
                    </td>
                    <td>
                      <Link
                        aria-label={`Lihat kontribusi ${name}`}
                        href={`/incidents?contributor=${encodeURIComponent(name)}`}
                      >
                        ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="rk-helper">
        Nama yang sama dikelompokkan bersama. Profil akun, reputasi, dan
        verifikasi identitas menunggu integrasi autentikasi.
      </p>
    </>
  );
}
function SystemPage() {
  const health = useResource<{
    status: string;
    engine: string;
    model_loaded: boolean;
    mode: string;
    storage: string;
  }>("/health");
  return (
    <>
      <PageTitle
        eyebrow="SISTEM"
        title="Transparan dari awal."
        description="Status layanan dan batas kemampuan workspace saat ini."
        action={
          <button className="rk-button rk-secondary" onClick={health.reload}>
            Periksa koneksi ↻
          </button>
        }
      />
      <section className="rk-system-section">
        <h2>Layanan lokal</h2>
        <dl className="rk-system-list">
          <div>
            <dt>API</dt>
            <dd>
              {health.error
                ? "Tidak terhubung"
                : health.data
                  ? "Terhubung"
                  : "Memeriksa…"}
              <small>{API}</small>
            </dd>
          </div>
          <div>
            <dt>RuasVision</dt>
            <dd>
              {health.data
                ? health.data.model_loaded
                  ? "Model tersedia"
                  : "Checkpoint belum dimuat"
                : "Belum diketahui"}
              <small>{health.data?.engine || "Status menunggu API"}</small>
            </dd>
          </div>
          <div>
            <dt>Penyimpanan</dt>
            <dd>
              {health.data?.storage || "Belum diketahui"}
              <small>Database persisten lokal, bukan penyimpanan cloud.</small>
            </dd>
          </div>
          <div>
            <dt>Akun & akses</dt>
            <dd>
              Mode operator lokal
              <small>
                Supabase Auth / RBAC belum dikonfigurasi. API dibatasi ke
                loopback.
              </small>
            </dd>
          </div>
        </dl>
        {health.error && (
          <p className="rk-error" role="alert">
            {health.error}
          </p>
        )}
      </section>
      <section className="rk-system-section">
        <h2>Ruang lingkup rilis</h2>
        <dl className="rk-system-list">
          <div>
            <dt>Deteksi pothole</dt>
            <dd>
              Segmentasi foto
              <small>
                Hasil AI adalah bukti awal, bukan keputusan perbaikan otomatis.
              </small>
            </dd>
          </div>
          <div>
            <dt>RuasDepth</dt>
            <dd>
              Kedalaman cm belum tersedia
              <small>Tidak ada klaim ukuran metrik tanpa kalibrasi.</small>
            </dd>
          </div>
          <div>
            <dt>Lokasi & privasi</dt>
            <dd>
              Koordinat manual / GPS perangkat
              <small>
                EXIF dibersihkan. GeoFusion, road matching, serta blur
                wajah/pelat belum tersedia.
              </small>
            </dd>
          </div>
          <div>
            <dt>Laporan</dt>
            <dd>
              Snapshot internal + cetak
              <small>
                Hash untuk JSON, bukan PDF resmi atau tanda tangan digital.
              </small>
            </dd>
          </div>
        </dl>
      </section>
      <details className="rk-system-help">
        <summary>Cara menjalankan layanan</summary>
        <p>Dari root proyek, jalankan API di terminal terpisah:</p>
        <code>
          .\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --host
          127.0.0.1 --port 8000
        </code>
        <p>
          Model memakai GPU jika tersedia dan CPU sebagai fallback. Tidak
          menjalankan training.
        </p>
      </details>
    </>
  );
}
