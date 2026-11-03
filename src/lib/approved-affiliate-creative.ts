import type { CTAEntry } from "./articles";

/**
 * Full, unmodified ad markup supplied by the site owner on 2026-10-16.
 * The original ad links, image URLs, dimensions and link attributes are
 * intentionally preserved. Never synthesize a clickable ad from registry.url.
 */
const APPROVED_CREATIVE: Record<string, { destination: string; html: string }> = {
  retirement_jobs: {
    destination: "https://h.accesstrade.net/sp/cc?rk=0100q25q00ovm3",
    html: '<a href="https://h.accesstrade.net/sp/cc?rk=0100q25q00ovm3" rel="nofollow" referrerpolicy="no-referrer-when-downgrade"><img src="https://h.accesstrade.net/sp/rr?rk=0100q25q00ovm3" alt="退職代行Jobs" border="0" width="120" height="60"></a>',
  },
  samurai_job: {
    destination: "https://h.accesstrade.net/sp/cc?rk=0100q6nt00ovm3",
    html: '<a href="https://h.accesstrade.net/sp/cc?rk=0100q6nt00ovm3" rel="nofollow" referrerpolicy="no-referrer-when-downgrade"><img src="https://h.accesstrade.net/sp/rr?rk=0100q6nt00ovm3" alt="Samurai Job" border="0" width="250" height="250"></a>',
  },
};

export function approvedCreativeHtml(key: string, entry: CTAEntry | undefined): string | null {
  if (!entry || entry.affiliate === false) return null;
  const saved = Object.prototype.hasOwnProperty.call(APPROVED_CREATIVE, key)
    ? APPROVED_CREATIVE[key]
    : undefined;
  // A changed destination is treated as unapproved, even if the name matches.
  return saved && entry.url === saved.destination ? saved.html : null;
}

/** Non-affiliate URLs may be linked normally; paid URLs require original ad markup. */
export function isSafeEditorialLink(entry: CTAEntry | undefined): boolean {
  if (!entry || entry.affiliate !== false) return false;
  try {
    return ["https:", "http:"].includes(new URL(entry.url).protocol);
  } catch {
    return false;
  }
}
