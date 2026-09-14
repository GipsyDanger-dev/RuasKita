"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Incident } from "@/lib/workspace";

export default function RoadMap({
  items,
  selected,
  onSelect,
  onPick,
  pin,
}: {
  items: Incident[];
  selected?: string;
  onSelect?: (id: string) => void;
  onPick?: (latitude: number, longitude: number) => void;
  pin?: [number, number];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
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
  }, [items, selected]);
  useEffect(() => {
    if (pin) map.current?.easeTo({ center: pin, duration: 0 });
  }, [pin]);
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
