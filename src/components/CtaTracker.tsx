"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * クリック計測をdocument単位で1か所にまとめる。
 * - `data-track-event` を持つリンク: その値をイベント名として送る
 *   （`data-track-format` など `data-track-*` は小文字キーでパラメータに含める）
 * - それ以外の `a.cta-button`: `cta_click` を送る
 */
export function CtaTracker() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest<HTMLAnchorElement>("a[data-track-event], a.cta-button");
      if (!link) return;

      window.dataLayer = window.dataLayer || [];
      const { trackEvent, ...rest } = link.dataset;
      if (trackEvent) {
        const params: Record<string, unknown> = { event: trackEvent };
        for (const [key, value] of Object.entries(rest)) {
          if (key.startsWith("track")) params[key.slice(5).toLowerCase()] = value;
        }
        window.dataLayer.push(params);
        return;
      }

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
