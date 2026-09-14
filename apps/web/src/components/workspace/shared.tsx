"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  api,
  dateLabel,
  detailURL,
  Incident,
  severityNames,
  shortId,
  statusNames,
  Status,
} from "@/lib/workspace";

export function useResource<T>(path: string) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    path?: string;
  }>({});
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then((data) => setState({ data, path }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ error: error.message, path });
      });
    return () => controller.abort();
  }, [path, version]);
  return {
    data: state.path === path ? state.data : undefined,
    error: state.path === path ? state.error : undefined,
    reload: () => {
      setState({});
      setVersion((v) => v + 1);
    },
  };
}
export function LoadState({
  error,
  reload,
}: {
  error?: string;
  reload: () => void;
}) {
  return (
    <div className="rk-empty" role={error ? "alert" : "status"}>
      <span className="rk-kicker">{error ? "KONEKSI" : "SEBENTAR"}</span>
      <h2>{error ? "Data belum bisa dimuat" : "Memuat workspace…"}</h2>
      <p>{error ?? "Mengambil data tersimpan."}</p>
      {error && (
        <button className="rk-button" onClick={reload}>
          Coba lagi
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = "Belum ada insiden",
  description = "Mulai dari satu foto jalan. Laporan yang disimpan akan muncul di sini.",
  action = true,
}: {
  title?: string;
  description?: string;
  action?: boolean;
}) {
  return (
    <div className="rk-empty">
      <span className="rk-empty-symbol" aria-hidden="true">
        ↗
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link className="rk-button" href="/incidents/new">
          Buat laporan pertama
        </Link>
      )}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rk-page-heading">
      <div>
        <p className="rk-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Badge({ status }: { status: Status }) {
  return (
    <span className={`rk-badge ${status}`}>
      <i />
      {statusNames[status]}
    </span>
  );
}
export function IncidentTable({ items }: { items: Incident[] }) {
  if (!items.length)
    return (
      <Empty
        title="Tidak ada hasil"
        description="Belum ada data untuk pilihan ini. Coba ubah pencarian atau filter."
        action={false}
      />
    );
  return (
    <div className="rk-table-wrap">
      <table className="rk-table">
        <thead>
          <tr>
            <th scope="col">Lokasi / insiden</th>
            <th scope="col">Tingkat perhatian</th>
            <th scope="col">Status</th>
            <th scope="col">Diperbarui</th>
            <th scope="col">
              <span className="rk-sr">Detail</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                <Link className="rk-road-link" href={detailURL(i.id)}>
                  {i.road}
                </Link>
                <small>
                  {shortId(i.id)} · {i.observations.length} bukti
                </small>
              </td>
              <td>
                <span className={`rk-severity ${i.severity}`}>
                  {severityNames[i.severity]}
                </span>
              </td>
              <td>
                <Badge status={i.status} />
              </td>
              <td>{dateLabel(i.updated_at)}</td>
              <td>
                <Link
                  className="rk-arrow-link"
                  aria-label={`Detail ${i.road}`}
                  href={detailURL(i.id)}
                >
                  ↗
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ErrorMessage({ error }: { error?: string }) {
  return error ? (
    <p className="rk-error" role="alert">
      {error}
    </p>
  ) : null;
}
