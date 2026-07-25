declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, string>) {
  if (typeof window === "undefined") return;

  // GTM dataLayer (NARU本体と同じ経路)
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...params });

  // gtag fallback (独立デプロイ時の互換)
  if (window.gtag) {
    window.gtag("event", name, params);
  }
}
