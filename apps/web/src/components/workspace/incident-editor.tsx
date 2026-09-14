"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  actionNames,
  dateLabel,
  detailURL,
  Incident,
  post,
  shortId,
  Status,
  statusNames,
  transitions,
  severityNames,
} from "@/lib/workspace";
import EvidenceInput, { EvidenceImage } from "./evidence";
import {
  Badge,
  ErrorMessage,
  LoadState,
  PageTitle,
  useResource,
} from "./shared";
const RoadMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <div className="rk-map-placeholder">Menyiapkan peta…</div>,
});
const noItems: Incident[] = [];

export function NewIncident() {
  const router = useRouter();
  const requestId = useRef("");
  const [evidence, setEvidence] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const pin = useMemo<[number, number] | undefined>(
    () =>
      lat &&
      lng &&
      Number.isFinite(+lat) &&
      Number.isFinite(+lng) &&
      Math.abs(+lat) <= 90 &&
      Math.abs(+lng) <= 180
        ? [+lng, +lat]
        : undefined,
    [lat, lng],
  );
  function locate() {
    if (!navigator.geolocation) {
      setError("Browser ini tidak mendukung lokasi. Pilih titik di peta.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError(
          "Lokasi tidak diizinkan atau tidak tersedia. Pilih titik di peta atau isi koordinat.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!evidence || busy) return;
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    requestId.current ||= crypto.randomUUID();
    try {
      const item = await post<Incident>("/v1/incidents", {
        request_id: requestId.current,
        road: data.road,
        notes: data.notes,
        contributor: data.contributor,
        severity: data.severity,
        latitude: +lat,
        longitude: +lng,
        evidence_id: evidence,
      });
      router.push(detailURL(item.id));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="rk-back" href="/incidents">
        ← Semua insiden
      </Link>
      <PageTitle
        eyebrow="LAPORAN BARU"
        title="Mulai dari bukti."
        description="Catat kondisi yang terlihat. Setiap laporan masuk sebagai kandidat untuk ditinjau."
      />
      <form className="rk-editor-grid" onSubmit={submit}>
        <div>
          <div className="rk-section-heading">
            <span>01</span>
            <h2>Bukti visual</h2>
          </div>
          <EvidenceInput onChange={setEvidence} disabled={busy} />
          <p className="rk-helper">
            Analisis AI opsional. Foto tanpa analisis tetap bisa dilaporkan
            secara manual. Kedalaman dalam cm belum tersedia.
          </p>
          <p className="rk-helper">
            Gunakan foto tanpa wajah atau pelat yang dapat dikenali. Metadata
            EXIF dibersihkan; blur otomatis belum tersedia.
          </p>
        </div>
        <div>
          <div className="rk-section-heading">
            <span>02</span>
            <h2>Lokasi & kondisi</h2>
          </div>
          <fieldset disabled={busy} className="rk-fieldset">
            <label className="rk-field">
              Nama ruas jalan
              <input
                name="road"
                required
                minLength={3}
                maxLength={150}
                placeholder="Contoh: Jl. Kaliurang KM 5"
              />
            </label>
            <div className="rk-field-pair">
              <label className="rk-field">
                Latitude
                <input
                  name="latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  required
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="-7.7956"
                />
              </label>
              <label className="rk-field">
                Longitude
                <input
                  name="longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  required
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="110.3695"
                />
              </label>
            </div>
            <div className="rk-location-picker">
              <RoadMap
                items={noItems}
                pin={pin}
                onPick={(a, b) => {
                  setLat(String(a));
                  setLng(String(b));
                }}
              />
            </div>
            <button
              className="rk-text-button"
              type="button"
              onClick={locate}
              disabled={locating}
            >
              {locating ? "Mencari lokasi…" : "⌖ Gunakan lokasi perangkat"}
            </button>
            <p className="rk-helper">
              Klik peta untuk menentukan titik kerusakan. GPS adalah posisi
              perangkat, bukan hasil GeoFusion.
            </p>
            <label className="rk-field">
              Tingkat perhatian awal
              <select name="severity" defaultValue="medium">
                <option value="low">Rendah</option>
                <option value="medium">Sedang</option>
                <option value="high">Tinggi</option>
              </select>
              <small>
                Penilaian pelapor, bukan ukuran kedalaman atau skor AI.
              </small>
            </label>
            <label className="rk-field">
              Catatan kondisi
              <textarea
                name="notes"
                required
                minLength={5}
                maxLength={3000}
                rows={3}
                placeholder="Apa yang terlihat dan apa risikonya?"
              />
            </label>
            <label className="rk-field">
              Nama pelapor
              <input
                name="contributor"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
              />
            </label>
          </fieldset>
          <ErrorMessage error={error} />
          <div className="rk-form-actions">
            <Link href="/incidents" className="rk-text-button">
              Batal
            </Link>
            <button className="rk-button" disabled={!evidence || busy}>
              {busy ? "Menyimpan…" : "Simpan kandidat insiden →"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

export function IncidentDetail({ id }: { id: string }) {
  const resource = useResource<Incident>(
    `/v1/incidents/${encodeURIComponent(id)}`,
  );
  if (!resource.data) return <LoadState {...resource} />;
  return (
    <IncidentContent
      key={`${id}-${resource.data.revision}`}
      item={resource.data}
      reload={resource.reload}
    />
  );
}
function IncidentContent({
  item,
  reload,
}: {
  item: Incident;
  reload: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [photo, setPhoto] = useState(item.observations.length - 1);
  const [next, setNext] = useState<Status>(transitions[item.status][0]);
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const observation = item.observations[photo];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      if (tab === "observation")
        await post(`/v1/incidents/${item.id}/observations`, {
          revision: item.revision,
          evidence_id: evidence,
          notes: data.note,
          contributor: data.contributor,
        });
      else
        await post(`/v1/incidents/${item.id}/transition`, {
          revision: item.revision,
          status: next,
          note: data.note,
          assignee: data.assignee ?? "",
          evidence_id: evidence || null,
        });
      reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/incidents" className="rk-back">
        ← Semua insiden
      </Link>
      <PageTitle
        eyebrow={shortId(item.id)}
        title={item.road}
        description={`Dilaporkan ${dateLabel(item.created_at)} · ${item.contributor}`}
        action={<Badge status={item.status} />}
      />
      <div className="rk-tabs" role="tablist" aria-label="Detail insiden">
        {[
          ["overview", "Ringkasan"],
          ["history", "Riwayat"],
          ["action", "Tindak lanjut"],
          ["observation", "Tambah observasi"],
        ].map(([value, label]) => (
          <button
            role="tab"
            aria-selected={tab === value}
            aria-controls="incident-panel"
            id={`tab-${value}`}
            key={value}
            onClick={() => {
              setTab(value);
              setError("");
              setEvidence("");
            }}
            disabled={busy}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="incident-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && (
          <div className="rk-detail-grid">
            <section>
              <EvidenceImage
                id={observation.evidence_id}
                analysis={observation.analysis}
              />
              <div className="rk-photo-caption">
                <span>
                  {dateLabel(observation.recorded_at)} ·{" "}
                  {observation.kind === "repair"
                    ? "Bukti perbaikan"
                    : "Observasi"}
                </span>
                <div>
                  <button
                    className="rk-icon-button"
                    disabled={photo === 0}
                    aria-label="Bukti sebelumnya"
                    onClick={() => setPhoto(photo - 1)}
                  >
                    ←
                  </button>
                  <span>
                    {photo + 1} / {item.observations.length}
                  </span>
                  <button
                    className="rk-icon-button"
                    disabled={photo === item.observations.length - 1}
                    aria-label="Bukti berikutnya"
                    onClick={() => setPhoto(photo + 1)}
                  >
                    →
                  </button>
                </div>
              </div>
              <p className="rk-note">{observation.notes}</p>
            </section>
            <aside className="rk-detail-meta">
              <h2>Informasi insiden</h2>
              <dl>
                <dt>Tingkat perhatian (manual)</dt>
                <dd className={`rk-severity ${item.severity}`}>
                  {severityNames[item.severity]}
                </dd>
                <dt>Penanggung jawab</dt>
                <dd>{item.assignee || "Belum ditugaskan"}</dd>
                <dt>Lokasi yang dilaporkan</dt>
                <dd>
                  {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                  <Link href={`/map?id=${item.id}`}>Lihat di peta ↗</Link>
                </dd>
                <dt>Analisis bukti terpilih</dt>
                <dd>
                  {observation.analysis
                    ? `${observation.analysis.potholes.length} deteksi · ${observation.analysis.engine}`
                    : "Belum dianalisis AI"}
                </dd>
                <dt>Kedalaman metrik</dt>
                <dd>Belum terukur</dd>
              </dl>
              <p className="rk-helper">
                Ditinjau berarti pemeriksaan manual di workspace lokal, bukan
                verifikasi lapangan atau sertifikasi.
              </p>
              <Link
                className="rk-button rk-secondary"
                href={`/ruasview?id=${item.id}`}
              >
                Buka RuasView ↗
              </Link>
            </aside>
          </div>
        )}
        {tab === "history" && (
          <section className="rk-timeline">
            <h2>Jejak perubahan</h2>
            {[...item.history].reverse().map((event, index) => (
              <article key={index}>
                <span className="rk-timeline-dot" />
                <div>
                  <Badge status={event.status} />
                  <p>{event.note}</p>
                  <small>{new Date(event.at).toLocaleString("id-ID")}</small>
                </div>
              </article>
            ))}
          </section>
        )}
        {(tab === "action" || tab === "observation") && (
          <form className="rk-action-form" onSubmit={submit}>
            <h2>
              {tab === "observation"
                ? "Satu insiden, bukti yang terus bertambah."
                : "Langkah penanganan berikutnya"}
            </h2>
            <p className="rk-muted">
              {tab === "observation"
                ? "Tambahkan foto baru ke insiden yang sama agar tidak membuat laporan ganda."
                : "Setiap perubahan tersimpan dalam riwayat insiden."}
            </p>
            <fieldset className="rk-fieldset" disabled={busy}>
              {tab === "action" && (
                <>
                  <label className="rk-field">
                    Tindakan
                    <select
                      value={next}
                      onChange={(e) => setNext(e.target.value as Status)}
                    >
                      {transitions[item.status].map((s) => (
                        <option value={s} key={s}>
                          {actionNames[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {next === "assigned" && (
                    <label className="rk-field">
                      Penanggung jawab
                      <input
                        name="assignee"
                        minLength={2}
                        maxLength={100}
                        required
                        placeholder="Nama petugas atau tim"
                      />
                    </label>
                  )}
                  {next === "resolved" && (
                    <label className="rk-check">
                      <input type="checkbox" required />
                      Saya telah meninjau bukti perbaikan. Ini catatan
                      pemeriksaan lokal, bukan klaim verifikasi lapangan.
                    </label>
                  )}
                </>
              )}
              {(tab === "observation" || next === "recheck") && (
                <EvidenceInput
                  key={tab}
                  onChange={setEvidence}
                  label={
                    tab === "observation"
                      ? "Foto observasi baru"
                      : "Foto setelah perbaikan"
                  }
                />
              )}
              {tab === "observation" && (
                <label className="rk-field">
                  Nama kontributor
                  <input
                    name="contributor"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
              )}
              <label className="rk-field">
                Catatan {tab === "action" ? "tindakan" : "observasi"}
                <textarea
                  name="note"
                  required
                  minLength={5}
                  maxLength={3000}
                  rows={4}
                />
              </label>
            </fieldset>
            <ErrorMessage error={error} />
            {error.includes("Muat ulang") && (
              <button type="button" className="rk-text-button" onClick={reload}>
                Muat ulang data
              </button>
            )}
            <button
              className="rk-button"
              disabled={
                busy ||
                ((tab === "observation" || next === "recheck") && !evidence)
              }
            >
              {busy
                ? "Menyimpan…"
                : tab === "observation"
                  ? "Simpan observasi"
                  : actionNames[next]}
            </button>
            <p className="rk-helper">
              Status saat ini: {statusNames[item.status]}. Tidak ada perubahan
              sampai disimpan.
            </p>
          </form>
        )}
      </div>
    </>
  );
}
