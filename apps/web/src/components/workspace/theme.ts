"use client";
import { useSyncExternalStore } from "react";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("ruas-theme", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ruas-theme", callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem("ruas-theme") === "dark";
  } catch {
    return false;
  }
}
export function useTheme() {
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);
  return {
    dark,
    toggle: () => {
      try {
        localStorage.setItem("ruas-theme", dark ? "light" : "dark");
        window.dispatchEvent(new Event("ruas-theme"));
      } catch {
        /* retain the readable default if storage is unavailable */
      }
    },
  };
}
