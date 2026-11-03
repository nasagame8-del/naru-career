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

    // Visibility measures potential CTA exposure, not conversions. Only count
    // each block once after at least half its area enters the viewport.
    const elements = document.querySelectorAll<HTMLElement>('[data-cta-impression="true"]');
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLElement;
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
              event: "cta_impression",
              cta_id: el.dataset.ctaId || "unknown",
              placement: el.dataset.ctaPlacement || "unknown",
              article_slug: el.dataset.ctaSlug || "unknown",
            });
            observer?.unobserve(el);
          }
        }, { threshold: 0.5 });
    if (observer) elements.forEach((el) => observer.observe(el));

    return () => {
      document.removeEventListener("click", handleClick);
      observer?.disconnect();
    };
  }, []);

  return null;
}
