"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const controller = navigator.serviceWorker.controller;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        // Eagerly update on new SW
        reg.addEventListener?.("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Optionally: self-skip-waiting flow
              // We could notify the user to refresh; keeping silent for game flow
            }
          });
        });
      } catch (e) {
        // no-op
      }
    };

    // Register after page load for stability
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register as any);
    };
  }, []);

  return null;
}

