"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Incident } from "@/lib/workspace";
import type { ScanPoint } from "@/lib/scans";

export default function RoadMap({
  items,
  selected,
  onSelect,
  onPick,
  pin,
  coverage,
}: {
  items: Incident[];
  selected?: string;
  onSelect?: (id: string) => void;
  onPick?: (latitude: number, longitude: number) => void;
  pin?: [number, number];
  coverage?: ScanPoint[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const viewportKey = useRef("");
  const coverageFramed = useRef(false);
  const callbacks = useRef({ onSelect, onPick });
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    callbacks.current = { onSelect, onPick };
  }, [onSelect, onPick]);
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        center: [110.3695, -7.7956],
        zoom: 11,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
            },
          },
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm",
              paint: { "raster-saturation": -0.8, "raster-contrast": -0.08 },
            },
          ],
        },
      });
    } catch {
      queueMicrotask(() =>
        setError(
          "Peta membutuhkan WebGL. Daftar insiden dan isian koordinat tetap dapat digunakan.",
        ),
      );
      return;
    }
    map.current = instance;
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    instance.addControl(new maplibregl.ScaleControl({ unit: "metric" }));
    instance.on("load", () => setLoaded(true));
    instance.on("error", () =>
      setError(
        "Latar peta belum termuat. Periksa koneksi internet; daftar dan koordinat tetap tersedia.",
      ),
    );
    instance.on("click", (e) =>
      callbacks.current.onPick?.(
        Number(e.lngLat.lat.toFixed(6)),
        Number(e.lngLat.lng.toFixed(6)),
      ),
    );
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      // Strict Mode remounts the map; its new viewport has not been framed yet.
      viewportKey.current = "";
      coverageFramed.current = false;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const markers = items.map((item) => {
      const element = document.createElement("button");
      element.className = `rk-geo-marker ${item.status === "resolved" ? "resolved" : item.severity} ${selected === item.id ? "chosen" : ""}`;
      element.setAttribute("aria-label", `Pilih ${item.road}`);
      element.addEventListener("click", (e) => {
        e.stopPropagation();
        callbacks.current.onSelect?.(item.id);
      });
      return new maplibregl.Marker({ element })
        .setLngLat([item.longitude, item.latitude])
        .addTo(map.current!);
    });
    if (pin)
      markers.push(
        new maplibregl.Marker({ color: "#203b35" })
          .setLngLat(pin)
          .addTo(map.current),
      );
    return () => markers.forEach((marker) => marker.remove());
  }, [items, selected, pin]);
  useEffect(() => {
    if (pin) return;
    const key = JSON.stringify([selected, items.map((item) => [item.id, item.longitude, item.latitude])]);
    if (key === viewportKey.current) return;
    viewportKey.current = key;
    const target = items.find((item) => item.id === selected);
    if (target)
      map.current?.easeTo({
        center: [target.longitude, target.latitude],
        zoom: 15,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 500,
      });
    else if (items.length) {
      const bounds = new maplibregl.LngLatBounds();
      items.forEach((i) => bounds.extend([i.longitude, i.latitude]));
      map.current?.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 0 });
    }
  }, [items, selected, pin]);
  useEffect(() => {
    if (pin) map.current?.easeTo({ center: pin, duration: 0 });
  }, [pin]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded) return;
    const features: GeoJSON.Feature[] = [];
    const previous = new Map<string, ScanPoint>();
    for (const point of coverage ?? []) {
      const properties = { state: point.state };
      features.push({ type: "Feature", properties, geometry: { type: "Point", coordinates: [point.longitude, point.latitude] } });
      const last = previous.get(point.session_id ?? "");
      if (last) {
        const seconds = (Date.parse(point.captured_at) - Date.parse(last.captured_at)) / 1000;
        const distance = Math.hypot((point.latitude - last.latitude) * 111320, (point.longitude - last.longitude) * 111320 * Math.cos(point.latitude * Math.PI / 180));
        if (seconds > 0 && seconds <= 20 && distance <= 100) features.push({ type: "Feature", properties,
          geometry: { type: "LineString", coordinates: [[last.longitude, last.latitude], [point.longitude, point.latitude]] } });
      }
      previous.set(point.session_id ?? "", point);
    }
    const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
    if (!coverageFramed.current && coverage?.length && !pin && !items.length) {
      const bounds = new maplibregl.LngLatBounds();
      coverage.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      instance.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 0 });
      coverageFramed.current = true;
    }
    const source = instance.getSource("scan-coverage") as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      instance.addSource("scan-coverage", { type: "geojson", data });
      const color: maplibregl.ExpressionSpecification = ["match", ["get", "state"], "detected", "#ad4d28", "no_detection", "#32618c", "#72787d"];
      instance.addLayer({ id: "scan-lines", type: "line", source: "scan-coverage", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": color, "line-width": 5, "line-opacity": 0.8 } });
      instance.addLayer({ id: "scan-points", type: "circle", source: "scan-coverage", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": color, "circle-radius": 4, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });
    }
  }, [coverage, loaded, pin, items.length]);
  return (
    <div className="rk-map-frame">
      <div
        ref={container}
        className="rk-real-map"
        aria-label={
          onPick ? "Klik peta untuk memilih lokasi" : "Peta lokasi insiden"
        }
      />
      {error && (
        <p className="rk-map-warning" role="status">
          {error}
        </p>
      )}
      {!error && !loaded && <p className="rk-map-warning" role="status">Memuat latar peta…</p>}
    </div>
  );
}
