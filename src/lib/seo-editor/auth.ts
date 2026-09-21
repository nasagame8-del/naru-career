/**
 * SEO Editor API の認証。
 *
 * /internal/* は src/middleware.ts の Basic 認証で保護されているが、
 * このAPIは記事生成とGitHub PR作成を起動できるため、
 * ルート側でも同じ資格情報を再検証する（多層防御）。
 */

import type { NextRequest } from "next/server";

export function isAuthorized(request: NextRequest): boolean {
  const user = process.env.DASHBOARD_USER || "admin";
  const pass = process.env.DASHBOARD_PASSWORD || "naru2026";

  const header = request.headers.get("authorization");
  if (!header) return false;
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  return decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass;
}
