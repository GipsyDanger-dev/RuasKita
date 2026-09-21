"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Analysis, api } from "@/lib/workspace";
import { ErrorMessage } from "./shared";

const FRAME_INTERVAL_MS = 1500;

type LiveSource = "camera" | "video";

export default function LiveCamera({
  onCapture,
  disabled = false,
}: {
  onCapture: (file: File) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectURLRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const analyzeFrameRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);
  const frameInFlightRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<LiveSource>("camera");
  const [videoFile, setVideoFile] = useState<File>();
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>();
  const [error, setError] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");

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

  const stopSession = useCallback(() => {
    activeRef.current = false;
    clearTimer();
    requestRef.current?.abort();
    requestRef.current = null;
    releaseMedia();
    setActive(false);
    setStarting(false);
    setAnalyzing(false);
  }, [clearTimer, releaseMedia]);

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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
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
    const canvas = drawFrame();
    if (!canvas) {
      scheduleFrame();
      return;
    }
    frameInFlightRef.current = true;
    setAnalyzing(true);
    try {
      const blob = await captureBlob(canvas);
      if (!blob || !activeRef.current) return;
      const body = new FormData();
      body.append("image", blob, "live-frame.jpg");
      const controller = new AbortController();
      requestRef.current = controller;
      const response = await api<Analysis>(
        "/v1/inference/image?confidence=0.5",
        { method: "POST", body, signal: controller.signal },
      );
      if (activeRef.current) {
        setAnalysis(response);
        setError("");
      }
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      const message =
        caught instanceof Error ? caught.message : "Analisis frame gagal.";
      stopSession();
      setError(`Live scan dihentikan: ${message}`);
    } finally {
      requestRef.current = null;
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
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser ini tidak menyediakan akses kamera.");
      return;
    }
    setActive(false);
    setStarting(true);
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
        if (!activeRef.current && !streamRef.current) {
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
      activeRef.current = true;
      setActive(true);
      scheduleFrame(0);
    } catch (caught) {
      const message =
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Akses kamera ditolak. Izinkan kamera lalu coba lagi."
          : caught instanceof Error && caught.message === "Izin kamera belum merespons."
            ? caught.message
            : "Kamera tidak dapat dimulai. Periksa perangkat dan izin browser.";
      stopSession();
      setError(message);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setStarting(false);
    }
  }, [scheduleFrame, stopSession]);

  const startVideo = useCallback(async () => {
    if (!videoFile) {
      setError("Pilih file video terlebih dahulu.");
      return;
    }
    setError("");
    setCaptureMessage("");
    setAnalysis(undefined);
    stopSession();
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
    onCapture(file);
    setCaptureMessage("Frame dipilih dan sedang diunggah sebagai bukti.");
  }, [captureBlob, drawFrame, onCapture]);

  const closePanel = () => {
    stopSession();
    setOpen(false);
    setError("");
    setCaptureMessage("");
  };

  return (
    <section className="rk-live-camera" aria-label="Live camera dan video">
      {!open && (
        <button
          type="button"
          className="rk-button rk-secondary rk-live-open"
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            setError("");
          }}
        >
          Buka live camera / video
        </button>
      )}
      {open && (
        <div className="rk-live-panel">
          <header className="rk-live-heading">
            <div>
              <p className="rk-kicker">PEMANTAUAN SEMENTARA</p>
              <h3>Scan dari kamera atau video</h3>
            </div>
            <button
              type="button"
              className="rk-text-button"
              onClick={closePanel}
              disabled={active}
            >
              Tutup
            </button>
          </header>
          <p className="rk-live-copy">
            Frame dianalisis berkala di API lokal. Tidak ada perekaman atau
            penyimpanan otomatis.
          </p>
          <div className="rk-live-sources" role="tablist" aria-label="Sumber live scan">
            <button
              type="button"
              role="tab"
              aria-selected={source === "camera"}
              disabled={active || starting}
              onClick={() => {
                setSource("camera");
                setError("");
              }}
            >
              Kamera perangkat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={source === "video"}
              disabled={active || starting}
              onClick={() => {
                setSource("video");
                setError("");
              }}
            >
              File video
            </button>
          </div>
          {source === "video" && (
            <label className="rk-live-video-input">
              <span>Pilih video jalan</span>
              <small>MP4, WebM, atau QuickTime · diproses lokal</small>
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
              controls={source === "video" && !active}
            />
            <canvas ref={canvasRef} hidden aria-hidden="true" />
            {analysis && (
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
              <p className="rk-live-placeholder">
                {starting
                  ? "Menyiapkan sumber live scan…"
                  : source === "camera"
                  ? "Mulai kamera untuk melihat frame jalan."
                  : "Pilih video, lalu mulai pemindaian."}
              </p>
            )}
          </div>
          <div className="rk-live-actions">
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
            <button
              type="button"
              className="rk-text-button"
              disabled={disabled || starting || !active}
              onClick={() => void captureCurrentFrame()}
            >
              Gunakan frame ini
            </button>
          </div>
          <div className="rk-live-status" role="status" aria-live="polite">
            {starting && <span>Meminta akses sumber live scan…</span>}
            {analyzing && <span>Menganalisis frame terbaru…</span>}
            {!analyzing && active && analysis && (
              <span>
                Frame terakhir: {analysis.potholes.length} pothole terdeteksi ·
                threshold {Math.round(analysis.confidence_threshold * 100)}%
              </span>
            )}
            {captureMessage && <span>{captureMessage}</span>}
          </div>
          <ErrorMessage error={error} />
        </div>
      )}
    </section>
  );
}
