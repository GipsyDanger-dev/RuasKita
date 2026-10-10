"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Analysis, api, post } from "@/lib/workspace";
import type { ScanReceipt } from "@/lib/scans";
import { ErrorMessage } from "./shared";

const FRAME_INTERVAL_MS = 1500;

type LiveSource = "camera" | "video";

export type LiveLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: number;
};

export default function LiveCamera({
  onCapture,
  onLocationChange,
  automatic,
  onSaved,
  disabled = false,
}: {
  onCapture?: (file: File) => void;
  onLocationChange?: (location: LiveLocation) => void;
  automatic?: { road: string; contributor: string };
  onSaved?: (receipt: ScanReceipt, sessionId: string) => void;
  disabled?: boolean;
}) {
  const panelId = useId();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectURLRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const analyzeFrameRef = useRef<(() => void) | null>(null);
  const cameraCancelRef = useRef<(() => void) | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const latestLocationRef = useRef<LiveLocation | undefined>(undefined);
  const scanSessionRef = useRef<string | null>(null);
  const sequenceRef = useRef(0);
  const generationRef = useRef(0);
  const callbacksRef = useRef({ onLocationChange, onSaved });
  const activeRef = useRef(false);
  const frameInFlightRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<LiveSource>("camera");
  const [videoFile, setVideoFile] = useState<File>();
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>();
  const [location, setLocation] = useState<LiveLocation>();
  const [locationError, setLocationError] = useState("");
  const [error, setError] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  useEffect(() => { callbacksRef.current = { onLocationChange, onSaved }; }, [onLocationChange, onSaved]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }
    if (objectURLRef.current) {
      URL.revokeObjectURL(objectURLRef.current);
      objectURLRef.current = "";
    }
  }, []);

  const stopLocationTracking = useCallback(() => {
    if (locationWatchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
    }
    locationWatchRef.current = null;
  }, []);

  const startLocationTracking = useCallback(() => {
    stopLocationTracking();
    latestLocationRef.current = undefined;
    setLocation(undefined);
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("GPS tidak tersedia di browser ini.");
      return;
    }
    locationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          capturedAt: position.timestamp,
        };
        setLocation(next);
        latestLocationRef.current = next;
        setLocationError("");
      },
      (positionError) => {
        const message =
          positionError.code === positionError.PERMISSION_DENIED
            ? "Akses lokasi ditolak. Isi titik laporan secara manual."
            : "GPS belum tersedia. Coba lagi di area dengan sinyal lebih baik.";
        setLocationError(message);
        latestLocationRef.current = undefined;
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }, [stopLocationTracking]);

  const stopSession = useCallback(() => {
    generationRef.current += 1;
    const sessionId = scanSessionRef.current;
    scanSessionRef.current = null;
    if (sessionId) {
      void api(`/v1/scans/${sessionId}/stop`, { method: "POST", keepalive: true }).catch(() => {
        setSaveMessage("Kamera berhenti. Server belum mengonfirmasi akhir sesi; data yang sudah tersimpan tetap ada.");
      });
    }
    activeRef.current = false;
    clearTimer();
    cameraCancelRef.current?.();
    cameraCancelRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
    stopLocationTracking();
    releaseMedia();
    setActive(false);
    setStarting(false);
    setAnalyzing(false);
  }, [clearTimer, releaseMedia, stopLocationTracking]);

  useEffect(() => {
    const pauseHidden = () => {
      if (document.hidden && activeRef.current) {
        stopSession();
        setSaveMessage("Scan dijeda karena halaman tidak aktif. Mulai lagi saat siap.");
      }
    };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => document.removeEventListener("visibilitychange", pauseHidden);
  }, [stopSession]);

  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

  useEffect(() => {
    if (disabled && activeRef.current) stopSession();
  }, [disabled, stopSession]);

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0)
      return null;
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  const captureBlob = useCallback(
    (canvas: HTMLCanvasElement) =>
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.82);
      }),
    [],
  );

  const scheduleFrame = useCallback(
    (delay = FRAME_INTERVAL_MS) => {
      clearTimer();
      if (!activeRef.current) return;
      timerRef.current = window.setTimeout(() => {
        void analyzeFrameRef.current?.();
      }, delay);
    },
    [clearTimer],
  );

  const analyzeFrame = useCallback(async () => {
    if (!activeRef.current || frameInFlightRef.current) {
      scheduleFrame();
      return;
    }
    const sessionId = scanSessionRef.current;
    const generation = generationRef.current;
    const gps = latestLocationRef.current;
    const capturedAt = Date.now();
    if (sessionId && (!gps || gps.accuracy === null || gps.accuracy <= 0 || gps.accuracy > 25 || capturedAt - gps.capturedAt > 5000)) {
      setSaveMessage("Belum disimpan. Menunggu GPS terbaru dengan akurasi ±25 m atau lebih baik.");
      scheduleFrame();
      return;
    }
    const canvas = drawFrame();
    if (!canvas) {
      scheduleFrame();
      return;
    }
    frameInFlightRef.current = true;
    setAnalyzing(true);
    try {
      const blob = await captureBlob(canvas);
      if (!blob || !activeRef.current || generation !== generationRef.current) return;
      const body = new FormData();
      body.append("image", blob, "live-frame.jpg");
      if (sessionId && gps) {
        body.append("metadata", JSON.stringify({ sequence: ++sequenceRef.current,
          captured_at: new Date(capturedAt).toISOString(), gps_at: new Date(gps.capturedAt).toISOString(),
          latitude: gps.latitude, longitude: gps.longitude, accuracy_m: gps.accuracy }));
      }
      const controller = new AbortController();
      requestRef.current = controller;
      const path = sessionId ? `/v1/scans/${sessionId}/frames` : "/v1/inference/image?confidence=0.5";
      let response: Analysis | ScanReceipt | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await api<Analysis | ScanReceipt>(path, {
            method: "POST", body, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
          });
          break;
        } catch (failure) {
          if (controller.signal.aborted || attempt === 2 || !sessionId) throw failure;
          setSaveMessage("Koneksi terganggu. Mengirim ulang frame yang sama…");
        }
      }
      if (activeRef.current && generation === generationRef.current && response) {
        if ("point" in response && sessionId) {
          setAnalysis(response.analysis);
          setSaveMessage(`${response.frame_count} frame tersimpan. ${response.incident_count} kandidat area dilaporkan.${response.point.state === "uncertain" ? " Frame terbaru kurang tajam; kondisi belum dinilai." : ""}`);
          callbacksRef.current.onSaved?.(response, sessionId);
        } else if (!("point" in response)) setAnalysis(response);
        setError("");
      }
    } catch (caught) {
      if (generation !== generationRef.current) return;
      const message =
        caught instanceof Error ? caught.message : "Analisis frame gagal.";
      stopSession();
      setError(`Live scan dihentikan: ${message}`);
    } finally {
      if (generation === generationRef.current) requestRef.current = null;
      frameInFlightRef.current = false;
      setAnalyzing(false);
      scheduleFrame();
    }
  }, [captureBlob, drawFrame, scheduleFrame, stopSession]);

  useEffect(() => {
    analyzeFrameRef.current = analyzeFrame;
  }, [analyzeFrame]);

  const startCamera = useCallback(async () => {
    setError("");
    setCaptureMessage("");
    setAnalysis(undefined);
    stopSession();
    const generation = generationRef.current;
    setSaveMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser ini tidak menyediakan akses kamera.");
      return;
    }
    setActive(false);
    setStarting(true);
    let cancelled = false;
    const cancelCameraStart = () => {
      cancelled = true;
    };
    cameraCancelRef.current = cancelCameraStart;
    let timeoutId: number | undefined;
    try {
      const streamRequest = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRequest.then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
        }
      }).catch(() => {
        // The race below owns the visible permission/error state.
      });
      const stream = await Promise.race([
        streamRequest,
        new Promise<MediaStream>((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error("Izin kamera belum merespons.")),
            15000,
          );
        }),
      ]);
      if (timeoutId) window.clearTimeout(timeoutId);
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setError("Pratinjau kamera belum siap. Coba lagi.");
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      if (cancelled) return;
      if (automatic) {
        const session = await post<{ id: string }>("/v1/scans", { request_id: crypto.randomUUID(), ...automatic });
        if (cancelled || generation !== generationRef.current) {
          void post(`/v1/scans/${session.id}/stop`, {}).catch(() => {});
          return;
        }
        scanSessionRef.current = session.id;
        sequenceRef.current = 0;
      }
      activeRef.current = true;
      setActive(true);
      startLocationTracking();
      scheduleFrame(0);
    } catch (caught) {
      if (generation !== generationRef.current) return;
      const message =
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Akses kamera ditolak. Izinkan kamera lalu coba lagi."
          : caught instanceof Error && caught.message === "Izin kamera belum merespons."
            ? caught.message
            : caught instanceof Error ? caught.message : "Kamera tidak dapat dimulai. Periksa perangkat dan izin browser.";
      stopSession();
      setError(message);
    } finally {
      if (cameraCancelRef.current === cancelCameraStart) {
        cameraCancelRef.current = null;
      }
      if (timeoutId) window.clearTimeout(timeoutId);
      if (generation === generationRef.current) setStarting(false);
    }
  }, [automatic, scheduleFrame, startLocationTracking, stopSession]);

  const startVideo = useCallback(async () => {
    if (!videoFile) {
      setError("Pilih file video terlebih dahulu.");
      return;
    }
    setError("");
    setCaptureMessage("");
    setAnalysis(undefined);
    stopSession();
    setLocation(undefined);
    latestLocationRef.current = undefined;
    const generation = generationRef.current;
    setStarting(true);
    const video = videoRef.current;
    if (!video) {
      setStarting(false);
      setError("Pratinjau video belum siap. Coba lagi.");
      return;
    }
    const objectURL = URL.createObjectURL(videoFile);
    objectURLRef.current = objectURL;
    video.src = objectURL;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.load();
    try {
      if (video.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            video.removeEventListener("loadedmetadata", onLoaded);
            video.removeEventListener("error", onError);
            resolve();
          };
          const onError = () => {
            video.removeEventListener("loadedmetadata", onLoaded);
            video.removeEventListener("error", onError);
            reject(new Error("File video tidak dapat dibaca."));
          };
          video.addEventListener("loadedmetadata", onLoaded, { once: true });
          video.addEventListener("error", onError, { once: true });
        });
      }
      await video.play();
      if (generation !== generationRef.current) return;
      activeRef.current = true;
      setActive(true);
      scheduleFrame(0);
    } catch (caught) {
      stopSession();
      setError(
        caught instanceof Error
          ? caught.message
          : "Video tidak dapat diputar.",
      );
    } finally {
      setStarting(false);
    }
  }, [scheduleFrame, stopSession, videoFile]);

  const chooseVideo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setVideoFile(undefined);
    if (!file.type.startsWith("video/")) {
      setError("File video tidak dikenali. Pilih MP4, WebM, atau QuickTime.");
      return;
    }
    setVideoFile(file);
    setSource("video");
    setError("");
    setCaptureMessage("");
  };

  const captureCurrentFrame = useCallback(async () => {
    const gps = latestLocationRef.current;
    const canvas = drawFrame();
    if (!canvas) {
      setError("Frame belum siap. Tunggu pratinjau berjalan lalu coba lagi.");
      return;
    }
    const blob = await captureBlob(canvas);
    if (!blob) {
      setError("Frame tidak dapat disiapkan sebagai foto.");
      return;
    }
    const file = new File([blob], `ruaskita-frame-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    if (source === "camera" && gps && Date.now() - gps.capturedAt <= 5000) callbacksRef.current.onLocationChange?.(gps);
    onCapture?.(file);
    setCaptureMessage("Frame dipilih dan sedang diunggah sebagai bukti.");
  }, [captureBlob, drawFrame, onCapture, source]);

  const closePanel = () => {
    stopSession();
    setOpen(false);
    setError("");
    setCaptureMessage("");
    requestAnimationFrame(() => openButtonRef.current?.focus());
  };

  return (
    <section className="rk-live-camera" aria-label="Live camera dan video">
      {!open && (
        <div className="rk-live-entry">
          <div>
            <h3>Scan langsung</h3>
            <p>Kamera atau video jalan.</p>
          </div>
          <button
            ref={openButtonRef}
            type="button"
            className="rk-button rk-live-open"
            aria-expanded={false}
            aria-controls={panelId}
            disabled={disabled}
            onClick={() => {
              setOpen(true);
              setError("");
              requestAnimationFrame(() => closeButtonRef.current?.focus());
            }}
          >
            Buka live scan
          </button>
        </div>
      )}
      {open && (
        <div className="rk-live-panel" id={panelId}>
          <header className="rk-live-heading">
            <div>
              <h3>Live scan</h3>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="rk-button rk-secondary rk-live-close"
              onClick={closePanel}
            >
              Tutup
            </button>
          </header>
          {!automatic && <div className="rk-live-sources" role="group" aria-label="Sumber live scan">
            <button
              type="button"
              aria-pressed={source === "camera"}
              disabled={active || starting}
              onClick={() => {
                setSource("camera");
                setError("");
                setAnalysis(undefined);
                setCaptureMessage("");
              }}
            >
              Kamera
            </button>
            <button
              type="button"
              aria-pressed={source === "video"}
              disabled={active || starting}
              onClick={() => {
                setSource("video");
                setError("");
                setAnalysis(undefined);
                setCaptureMessage("");
              }}
            >
              File video
            </button>
          </div>}
          {automatic && <p className="rk-helper">Frame dan GPS disimpan otomatis saat kamera dimulai. Operasikan dari posisi aman, bukan sambil mengemudi.</p>}
          {source === "video" && <p className="rk-helper">Video hanya pratinjau analisis. GPS saat ini bukan lokasi rekaman; tidak membuat laporan otomatis.</p>}
          {source === "video" && (
            <label className="rk-live-video-input">
              <span>Pilih video jalan</span>
              <small>MP4, WebM, atau QuickTime</small>
              <input
                aria-label="Pilih video jalan"
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                disabled={active || starting || disabled}
                onChange={chooseVideo}
              />
            </label>
          )}
          <div className="rk-live-stage">
            <video
              ref={videoRef}
              aria-label="Pratinjau kamera atau video jalan"
              playsInline
              muted
            />
            <canvas ref={canvasRef} hidden aria-hidden="true" />
            {active && analysis && (
              <svg
                role="img"
                aria-label={`${analysis.potholes.length} area terdeteksi AI pada frame terakhir`}
                viewBox={`0 0 ${analysis.image_shape.width} ${analysis.image_shape.height}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {analysis.potholes.map((pothole, index) => (
                  <polygon
                    key={index}
                    points={pothole.polygon_xy
                      .map(([x, y]) => `${x},${y}`)
                      .join(" ")}
                    fill="rgba(234,108,69,.28)"
                    stroke="#ed704c"
                    strokeWidth="3"
                  />
                ))}
              </svg>
            )}
            {!active && (
              <div className="rk-live-placeholder">
                <strong>{starting ? "Menyiapkan pratinjau…" : source === "camera" ? "Kamera belum aktif" : "Pratinjau video"}</strong>
                <span>{starting
                  ? source === "camera" ? "Izinkan akses kamera jika diminta." : "Membuka video…"
                  : source === "camera"
                    ? "Arahkan ke jalan dari posisi aman."
                    : videoFile ? "Video siap dipindai." : "Pilih file video untuk mulai."}</span>
              </div>
            )}
          </div>
          <div className="rk-live-actions">
            {active && onCapture && (
              <button
                type="button"
                className="rk-button"
                disabled={disabled || starting}
                onClick={() => void captureCurrentFrame()}
              >
                Gunakan frame ini
              </button>
            )}
            {starting ? (
              <button
                type="button"
                className="rk-button rk-secondary"
                onClick={stopSession}
              >
                Batalkan
              </button>
            ) : active ? (
              <button
                type="button"
                className="rk-button rk-secondary"
                onClick={stopSession}
              >
                Hentikan scan
              </button>
            ) : (
              <button
                type="button"
                className="rk-button"
                disabled={disabled || starting || (source === "video" && !videoFile)}
                onClick={() => void (source === "camera" ? startCamera() : startVideo())}
              >
                {source === "camera" ? "Mulai kamera" : "Putar & scan video"}
              </button>
            )}
          </div>
          <div className="rk-live-status" role="status" aria-live="polite" aria-atomic="true" aria-busy={analyzing}>
            {captureMessage ? <span>{captureMessage}</span> : active ? (
              analysis ? <span><strong>{analysis.potholes.length} lubang terdeteksi.</strong> {automatic ? "Hasil AI masih perlu ditinjau." : "Periksa hasil AI sebelum memilih frame."}</span>
                : <span>{analyzing ? "Menganalisis frame pertama…" : "Kamera aktif. Menunggu frame yang dapat diproses."}</span>
            ) : !starting && analysis && !error ? <span>Scan dihentikan.</span> : null}
          </div>
          {saveMessage && <p className="rk-helper" role="status" aria-atomic="true">{saveMessage}</p>}
          {active && source === "camera" && (
            <p className="rk-live-location" role="status" aria-live="polite">
              {location
                ? <>GPS aktif{location.accuracy !== null ? ` · akurasi ±${Math.round(location.accuracy)} m` : ""}</>
                : locationError || "Mencari lokasi perangkat…"}
            </p>
          )}
          <ErrorMessage error={error} />
          <p className="rk-live-copy">
            {automatic && source === "camera" ? "Dua frame berurutan diperlukan untuk kandidat area. Tidak ada deteksi bukan jaminan jalan baik. GPS menunjukkan posisi perangkat." : "Frame dianalisis di server. Bukti disimpan hanya saat dipilih."}
          </p>
        </div>
      )}
    </section>
  );
}
