/**
 * 出典URLの正規化（純粋関数のみ）。
 *
 * このモジュールは "use workflow" のサンドボックスへバンドルされうるため、
 * OpenAI・Node API・process.env に一切依存しないこと。
 * research.ts / source-repair.ts の双方から使う。
 */


/** 追跡パラメータ。根拠URLの同一性判定を邪魔するので落とす */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "yclid",
  "msclkid",
  "ref",
  "ref_src",
  "spm",
];

/**
 * 出典URLを比較可能な正規形にする。
 *
 * - http/https 以外は null
 * - ホスト名は小文字化し、先頭の www. を落とす
 * - 既定ポートを落とす
 * - 追跡パラメータを落とし、残りのクエリはキー順に並べ替える
 * - フラグメントを落とす
 * - 末尾スラッシュを落とす（ルートを除く）
 *
 * 正規化できない入力では null を返す。
 */
export function normalizeSourceUrl(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;

  u.hostname = u.hostname.toLowerCase();
  if (u.hostname.startsWith("www.")) u.hostname = u.hostname.slice(4);

  if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
    u.port = "";
  }

  for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
  u.searchParams.sort();
  u.hash = "";

  let out = u.toString();
  // 末尾スラッシュはルート以外で落とす
  if (u.pathname !== "/" && out.endsWith("/")) out = out.slice(0, -1);
  // クエリが空になった場合の "?" を落とす
  out = out.replace(/\?$/, "");
  return out;
}

/** 一次情報・公的機関とみなすホスト */
const AUTHORITATIVE_SUFFIXES = [
  ".go.jp",
  ".lg.jp",
  ".ac.jp",
  ".gov",
  ".edu",
  "jil.go.jp",
  "e-stat.go.jp",
  "stat.go.jp",
  "mhlw.go.jp",
  "meti.go.jp",
  "soumu.go.jp",
  "jpx.co.jp",
  "iso.org",
  "w3.org",
  "ietf.org",
];

/** 公的機関・標準化団体・一次情報かどうか */
export function isAuthoritativeUrl(url: string): boolean {
  const normalized = normalizeSourceUrl(url);
  if (!normalized) return false;
  let host: string;
  try {
    host = new URL(normalized).hostname;
  } catch {
    return false;
  }
  return AUTHORITATIVE_SUFFIXES.some((s) => host === s.replace(/^\./, "") || host.endsWith(s));
}
