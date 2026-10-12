import Link from "next/link";
import { type Incident, dateLabel, detailURL, evidenceURL, severityNames } from "@/lib/workspace";
import { Badge } from "./shared";

export function ReportList({ items }: { items: Incident[] }) {
  if (!items.length) return <div className="citizen-data-state"><h2>Belum ada laporan di sini</h2><p>Coba nama jalan lain, atau bagikan kondisi jalan yang kamu temui.</p><Link className="rk-button rk-secondary" href="/incidents/new">Buat laporan</Link></div>;
  return <div className="citizen-report-list">{items.map((item) => {
    const photo = item.observations.at(-1);
    return <article className="citizen-report-row" key={item.id}>
      <Link className="citizen-report-photo" href={detailURL(item.id)} aria-label={`Lihat foto laporan ${item.road}`}>
        {/* Evidence URLs are local API resources, not public image-optimizer inputs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo ? <img src={evidenceURL(photo.evidence_id)} alt={`Kondisi jalan ${item.road}`} loading="lazy" width="160" height="112" /> : <span>Foto belum tersedia</span>}
      </Link>
      <div className="citizen-report-copy"><small>{dateLabel(item.updated_at)}</small><h3><Link href={detailURL(item.id)}>{item.road}</Link></h3><p>{item.notes || photo?.notes || "Lihat foto dan lokasi pada rincian laporan."}</p></div>
      <div className="citizen-report-status"><Badge status={item.status} /><span>Perhatian {severityNames[item.severity].toLowerCase()}</span></div>
      <Link className="citizen-report-detail" href={detailURL(item.id)}>Lihat laporan<span className="rk-sr"> {item.road}</span></Link>
    </article>;
  })}</div>;
}
