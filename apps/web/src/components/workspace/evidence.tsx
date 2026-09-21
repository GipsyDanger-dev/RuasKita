"use client";
import { useState } from "react";
import { Analysis, api, evidenceURL, upload } from "@/lib/workspace";
import LiveCamera from "./live-camera";
import { ErrorMessage } from "./shared";

export function EvidenceImage({
  id,
  analysis,
  overlay = true,
}: {
  id: string;
  analysis?: Analysis | null;
  overlay?: boolean;
}) {
  return (
    <div
      className="rk-evidence-image"
      style={
        analysis
          ? {
              aspectRatio: `${analysis.image_shape.width} / ${analysis.image_shape.height}`,
            }
          : undefined
      }
    >
      <img src={evidenceURL(id)} alt="Bukti kondisi permukaan jalan" />
      {overlay && analysis && (
        <svg
          role="img"
          aria-label={`${analysis.potholes.length} area terdeteksi AI`}
          viewBox={`0 0 ${analysis.image_shape.width} ${analysis.image_shape.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {analysis.potholes.map((p, i) => (
            <polygon
              key={i}
              points={p.polygon_xy.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="rgba(234,108,69,.28)"
              stroke="#ed704c"
              strokeWidth="3"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
export default function EvidenceInput({
  onChange,
  analyze = true,
  label = "Foto bukti",
  disabled = false,
}: {
  onChange: (id: string, analysis?: Analysis) => void;
  analyze?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const [id, setId] = useState("");
  const [result, setResult] = useState<Analysis>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function choose(file?: File) {
    if (!file) return;
    setBusy("Mengunggah foto…");
    setError("");
    setId("");
    setResult(undefined);
    onChange("");
    try {
      const response = await upload(file);
      setId(response.id);
      onChange(response.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function run() {
    setBusy("RuasVision sedang menganalisis…");
    setError("");
    // Do not submit an observation before the in-flight server analysis is saved.
    onChange("");
    try {
      const response = await api<Analysis>(`/v1/evidence/${id}/analyze`, {
        method: "POST",
      });
      setResult(response);
      onChange(id, response);
    } catch (e) {
      setError((e as Error).message);
      onChange(id, result);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="rk-evidence-input">
      <label className="rk-upload">
        <span>{label}</span>
        <small>JPEG, PNG, WebP · maksimal 10 MB</small>
        <input
          aria-label={label}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!!busy || disabled}
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <LiveCamera onCapture={(file) => void choose(file)} disabled={!!busy || disabled} />
      {id && <EvidenceImage id={id} analysis={result} />}
      {id && analyze && (
        <button
          type="button"
          className="rk-button rk-secondary"
          disabled={!!busy || disabled}
          onClick={run}
        >
          {result ? "Analisis ulang" : "Analisis dengan RuasVision"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      )}
      {busy && (
        <p className="rk-muted" role="status">
          {busy}
        </p>
      )}
      <ErrorMessage error={error} />
      {result && (
        <div className="rk-analysis-result" role="status">
          <strong>{result.potholes.length} pothole terdeteksi</strong>
          <p>
            {result.potholes.length
              ? `Confidence: ${result.potholes.map((p) => `${Math.round(p.confidence * 100)}%`).join(", ")}`
              : "Tidak terdeteksi bukan berarti jalan pasti bebas kerusakan."}
          </p>
          <small>
            {result.engine} · ambang {result.confidence_threshold * 100}%
          </small>
        </div>
      )}
    </section>
  );
}
