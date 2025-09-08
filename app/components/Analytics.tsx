"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Build URL with query params for accurate page_view
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    // @ts-ignore - gtag injected via next/script in layout
    const gtag = (window as any).gtag as undefined | ((...args: any[]) => void);
    if (!gtag) return;

    gtag("event", "page_view", {
      page_path: url,
      page_location: typeof window !== "undefined" ? window.location.href : undefined,
      page_title: document.title,
      send_to: "G-XFBE0FWT1T",
    });
  }, [pathname, searchParams]);

  return null;
}

