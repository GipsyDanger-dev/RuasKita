import type { Analysis } from "./workspace";

export type ScanPoint = {
  session_id?: string;
  sequence: number;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  captured_at: string;
  state: "detected" | "no_detection" | "uncertain";
  incident_id: string | null;
};
export type ScanReceipt = {
  point: ScanPoint;
  analysis: Analysis;
  incident_id: string | null;
  frame_count: number;
  incident_count: number;
};
