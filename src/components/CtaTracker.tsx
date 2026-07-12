"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function CtaTracker() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest<HTMLAnchorElement>("a.cta-button");
      if (!link || !window.gtag) return;

      const agentName = link.textContent?.trim() || "unknown";
      window.gtag("event", "cta_click", {
        agent_name: agentName,
        link_url: link.href,
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
