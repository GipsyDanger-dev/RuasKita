export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
export type Status =
  "candidate" | "verified" | "assigned" | "in_repair" | "recheck" | "resolved";
export type Severity = "low" | "medium" | "high";
export type ObservationSource = "manual" | "ai" | "imported";
export type Analysis = {
  engine: string;
  model?: string;
  model_version?: string;
  generated_at: string;
  confidence_threshold: number;
  image_shape: { width: number; height: number };
  potholes: { confidence: number; polygon_xy: number[][] }[];
};
export type Observation = {
  evidence_id: string;
  created_at: string;
  recorded_at: string;
  contributor: string;
  notes: string;
  kind: string;
  source?: ObservationSource;
  model_version?: string | null;
  analysis: Analysis | null;
};
export type Incident = {
  id: string;
  request_id?: string;
  road: string;
  latitude: number;
  longitude: number;
  severity: Severity;
  status: Status;
  assignee: string;
  notes: string;
  contributor: string;
  road_normalized?: string;
  source?: ObservationSource;
  model_version?: string | null;
  location_confidence?: number | null;
  created_at: string;
  updated_at: string;
  revision: number;
  observations: Observation[];
  history: { status: Status; note: string; at: string }[];
};
export type Report = {
  id: string;
  sha256: string;
  integrity_valid?: boolean;
  snapshot: {
    title: string;
    road: string;
    start: string;
    end: string;
    generated_at: string;
    incidents: Incident[];
    policy: string;
  };
};
export const statusNames: Record<Status, string> = {
  candidate: "Kandidat",
  verified: "Ditinjau",
  assigned: "Ditugaskan",
  in_repair: "Diperbaiki",
  recheck: "Periksa ulang",
  resolved: "Selesai",
};
export const severityNames: Record<Severity, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
};
export const transitions: Record<Status, Status[]> = {
  candidate: ["verified"],
  verified: ["assigned"],
  assigned: ["in_repair"],
  in_repair: ["recheck"],
  recheck: ["resolved", "in_repair"],
  resolved: ["candidate"],
};
export const actionNames: Record<Status, string> = {
  candidate: "Buka kembali",
  verified: "Simpan hasil tinjauan",
  assigned: "Tugaskan perbaikan",
  in_repair: "Mulai perbaikan",
  recheck: "Kirim bukti perbaikan",
  resolved: "Konfirmasi selesai",
};
export const shortId = (id: string) => id.slice(0, 11).toUpperCase();
export const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const evidenceURL = (id: string) =>
  `${API}/v1/evidence/${encodeURIComponent(id)}`;
export const detailURL = (id: string) => `/incidents/${encodeURIComponent(id)}`;

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(120000),
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(
      "API belum terhubung atau waktu tunggu habis. Periksa halaman Sistem, lalu coba lagi.",
    );
  }
  const payload = await response.json();
  if (!response.ok)
    throw new Error(
      typeof payload.detail === "string"
        ? payload.detail
        : "Data belum valid. Periksa kembali isian formulir.",
    );
  return payload;
}
export async function upload(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Foto maksimal 10 MB.");
  const body = new FormData();
  body.append("image", file);
  return api<{ id: string }>("/v1/evidence", { method: "POST", body });
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export function downloadJSON(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
