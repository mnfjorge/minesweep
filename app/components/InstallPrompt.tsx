"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(userAgent: string): boolean {
  const ua = userAgent || "";
  // iPhone, iPad, iPod on iOS 13+ identifies as Mac with touch
  const iOSLike = /iPhone|iPad|iPod/i.test(ua) || (/(Macintosh|Mac OS X)/.test(ua) && typeof navigator !== "undefined" && (navigator as any).maxTouchPoints > 1);
  return iOSLike;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari
  const iosStandalone = (window.navigator as any).standalone;
  // All browsers supporting display-mode media query
  const displayModeStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  return Boolean(iosStandalone || displayModeStandalone);
}

const DISMISS_KEY = "pwa_install_banner_dismissed_v1";

export default function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);
  const deferredPromptRef = useRef<DeferredPromptEvent | null>(null);

  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMobile) return;
    if (isStandaloneMode()) return; // Already installed/opened standalone
    if (localStorage.getItem(DISMISS_KEY) === "1") return; // User dismissed

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault?.();
      deferredPromptRef.current = e as DeferredPromptEvent;
      setShowIosTip(false);
      setIsVisible(true);
    };

    const onAppInstalled = () => {
      setIsVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS Safari does not fire beforeinstallprompt
    if (isIos(navigator.userAgent)) {
      setShowIosTip(true);
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isMobile]);

  const handleInstallClick = async () => {
    const dp = deferredPromptRef.current;
    if (!dp) return;
    try {
      await dp.prompt();
      const choice = await dp.userChoice?.catch(() => undefined);
      if (choice && choice.outcome === "dismissed") {
        // keep banner visible; user can try again or dismiss
      } else {
        setIsVisible(false);
      }
      deferredPromptRef.current = null;
    } catch {
      // ignore
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="pwa-banner">
      <div className="pwa-banner__content">
        <div className="pwa-banner__text">
          <strong>Install Minesweeper</strong>
          {showIosTip ? (
            <span> Add this app to your Home Screen for a better experience.</span>
          ) : (
            <span> Get quick access and offline support by installing.</span>
          )}
        </div>
        <div className="pwa-banner__actions">
          {showIosTip ? (
            <a
              className="pwa-banner__link"
              href="https://support.apple.com/guide/iphone/add-websites-to-home-screen-iph42ab2f3a7/ios"
              target="_blank"
              rel="noreferrer noopener"
            >
              How to install
            </a>
          ) : (
            <button className="pwa-banner__button" onClick={handleInstallClick}>
              Install
            </button>
          )}
          <button className="pwa-banner__dismiss" onClick={handleDismiss} aria-label="Dismiss install banner">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

