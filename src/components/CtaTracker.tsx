"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function CtaTracker() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest<HTMLAnchorElement>("a.cta-button");
      if (!link) return;

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "cta_click",
        agent_name: link.textContent?.trim() || "unknown",
        link_url: link.href,
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
