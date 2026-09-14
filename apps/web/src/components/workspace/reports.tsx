"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  dateLabel,
  downloadJSON,
  Incident,
  post,
  Report,
  severityNames,
  shortId,
  statusNames,
} from "@/lib/workspace";
import {
  Empty,
  ErrorMessage,
  LoadState,
  PageTitle,
  useResource,
} from "./shared";

export function ReportsPage() {
  const reports = useResource<Report[]>("/v1/reports");
  const incidents = useResource<Incident[]>("/v1/incidents");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await post<Report>(
        "/v1/reports",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      router.push(`/reports/${result.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (!reports.data || !incidents.data)
    return (
      <LoadState
        error={reports.error || incidents.error}
        reload={() => {
          reports.reload();
          incidents.reload();
        }}
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="DOKUMENTASI"
        title="Laporan yang dapat ditelusuri."
        description="Simpan snapshot kondisi jalan untuk dokumentasi dan pembahasan internal."
        action={
          <button
            className="rk-button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            {open ? "Tutup formulir" : "+ Buat snapshot"}
          </button>
        }
      />
      {open && (
        <form className="rk-report-form" onSubmit={create}>
          <fieldset className="rk-fieldset" disabled={busy}>
            <label className="rk-field">
              Judul laporan
              <input
                name="title"
                required
                minLength={3}
                maxLength={150}
                placeholder="Kondisi jalan September 2026"
              />
            </label>
            <label className="rk-field">
              Ruas jalan
              <select name="road">
                <option value="">Semua ruas</option>
                {[...new Set(incidents.data.map((i) => i.road))]
                  .sort()
                  .map((road) => (
                    <option key={road}>{road}</option>
                  ))}
              </select>
            </label>
            <div className="rk-field-pair">
              <label className="rk-field">
                Tanggal awal
                <input type="date" name="start" required />
              </label>
              <label className="rk-field">
                Tanggal akhir
                <input type="date" name="end" required />
              </label>
            </div>
            <p className="rk-helper">
              Filter menggunakan tanggal insiden dibuat (UTC). Snapshot tidak
              berubah setelah dibuat.
            </p>
          </fieldset>
          <ErrorMessage error={error} />
          <button className="rk-button" disabled={busy}>
            {busy ? "Membuat snapshot…" : "Simpan snapshot"}
          </button>
        </form>
      )}
      {!reports.data.length ? (
        <Empty
          title="Belum ada snapshot laporan"
          description="Buat snapshot dari insiden tersimpan, lalu cetak atau unduh data JSON-nya."
          action={false}
        />
      ) : (
        <div className="rk-report-list">
          {reports.data.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <span className="rk-document-icon" aria-hidden="true">
                ▤
              </span>
              <div>
                <small>DRAF INTERNAL · {shortId(report.id)}</small>
                <h2>{report.snapshot.title}</h2>
                <p>
                  {dateLabel(report.snapshot.generated_at)} ·{" "}
                  {report.snapshot.incidents.length} insiden ·{" "}
                  {report.snapshot.road || "Semua ruas"}
                </p>
              </div>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
export function ReportDetail({ id }: { id: string }) {
  const report = useResource<Report>(`/v1/reports/${encodeURIComponent(id)}`);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function verify() {
    setBusy(true);
    try {
      const result = await api<Report>(`/v1/reports/${id}`);
      setMessage(
        result.integrity_valid
          ? "Hash snapshot cocok. Integritas JSON valid; ini bukan verifikasi PDF atau kondisi lapangan."
          : "Peringatan: hash snapshot tidak cocok.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!report.data) return <LoadState {...report} />;
  const { snapshot, sha256 } = report.data;
  return (
    <>
      <div className="rk-no-print">
        <Link href="/reports" className="rk-back">
          ← Semua laporan
        </Link>
        <PageTitle
          eyebrow="SNAPSHOT TERSIMPAN"
          title={snapshot.title}
          description="Dokumen internal. Data tetap sama walaupun insiden diperbarui."
          action={
            <button className="rk-button" onClick={() => window.print()}>
              Cetak / Simpan PDF ↗
            </button>
          }
        />
        <div className="rk-toolbar">
          <button
            className="rk-button rk-secondary"
            onClick={() => downloadJSON(report.data, `${id}.json`)}
          >
            Unduh JSON
          </button>
          <button
            className="rk-button rk-secondary"
            onClick={verify}
            disabled={busy}
          >
            {busy ? "Memeriksa…" : "Periksa hash snapshot"}
          </button>
        </div>
        {message && (
          <p className="rk-notice" role="status">
            {message}
          </p>
        )}
      </div>
      <article className="rk-print-sheet">
        <header>
          <span className="rk-print-brand">RuasKita</span>
          <span>DRAF INTERNAL</span>
        </header>
        <p className="rk-kicker">LAPORAN KONDISI JALAN</p>
        <h1>{snapshot.title}</h1>
        <p>
          {dateLabel(snapshot.start)} – {dateLabel(snapshot.end)} ·{" "}
          {snapshot.road || "Semua ruas"}
        </p>
        <div className="rk-metrics">
          <div>
            <strong>{snapshot.incidents.length}</strong>
            <span>Insiden tercatat</span>
          </div>
          <div>
            <strong>
              {snapshot.incidents.filter((i) => i.status === "resolved").length}
            </strong>
            <span>Selesai (catatan lokal)</span>
          </div>
          <div>
            <strong>
              {
                snapshot.incidents.filter(
                  (i) => i.severity === "high" && i.status !== "resolved",
                ).length
              }
            </strong>
            <span>Perhatian tinggi aktif</span>
          </div>
        </div>
        <div className="rk-table-wrap">
          <table className="rk-table">
            <thead>
              <tr>
                <th>Ruas / ID</th>
                <th>Perhatian</th>
                <th>Status</th>
                <th>Bukti</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.incidents.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.road}
                    <small>{shortId(i.id)}</small>
                  </td>
                  <td>{severityNames[i.severity]}</td>
                  <td>{statusNames[i.status]}</td>
                  <td>{i.observations.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rk-helper">{snapshot.policy}</p>
        <dl className="rk-report-integrity">
          <dt>ID laporan</dt>
          <dd>{id}</dd>
          <dt>Dibuat</dt>
          <dd>{new Date(snapshot.generated_at).toLocaleString("id-ID")}</dd>
          <dt>SHA-256 snapshot JSON</dt>
          <dd>{sha256}</dd>
        </dl>
      </article>
    </>
  );
}
