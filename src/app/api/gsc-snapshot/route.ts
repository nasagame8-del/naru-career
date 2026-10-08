import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EXPECTED_ISSUER = "https://token.actions.githubusercontent.com";
const EXPECTED_AUDIENCE = "naru-gsc-snapshot-v1";
const EXPECTED_REPOSITORY = "nasagame8-del/naru-career";
const EXPECTED_REF = "refs/heads/master";
const ALLOWED_WORKFLOW_REFS = new Set([
  "nasagame8-del/naru-career/.github/workflows/seo-opportunity-snapshot.yml@refs/heads/master",
  "nasagame8-del/naru-career/.github/workflows/seo-experiment-measurement.yml@refs/heads/master",
]);
const GITHUB_JWKS_URL =
  "https://token.actions.githubusercontent.com/.well-known/jwks";

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwtClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  sub?: string;
  repository?: string;
  ref?: string;
  workflow_ref?: string;
};

type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type SearchAnalyticsResponse = {
  rows?: SearchAnalyticsRow[];
};

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

function audienceMatches(aud: string | string[] | undefined): boolean {
  if (typeof aud === "string") return aud === EXPECTED_AUDIENCE;
  return Array.isArray(aud) && aud.includes(EXPECTED_AUDIENCE);
}

async function verifyGitHubOidc(token: string): Promise<JwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_jwt_shape");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonSegment<JwtHeader>(encodedHeader);
  const claims = decodeJsonSegment<JwtClaims>(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("unsupported_jwt_header");
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== EXPECTED_ISSUER ||
    !audienceMatches(claims.aud) ||
    !claims.exp ||
    claims.exp < now - 30 ||
    (claims.nbf && claims.nbf > now + 30) ||
    claims.repository !== EXPECTED_REPOSITORY ||
    claims.ref !== EXPECTED_REF ||
    !claims.workflow_ref ||
    !ALLOWED_WORKFLOW_REFS.has(claims.workflow_ref) ||
    claims.sub !== `repo:${EXPECTED_REPOSITORY}:ref:${EXPECTED_REF}`
  ) {
    throw new Error("jwt_claims_rejected");
  }

  const jwksResponse = await fetch(GITHUB_JWKS_URL, {
    cache: "no-store",
    headers: { "Accept-Encoding": "identity" },
  });
  if (!jwksResponse.ok) throw new Error("jwks_fetch_failed");

  const jwks = (await jwksResponse.json()) as {
    keys?: Array<JsonWebKey & { kid?: string; kty?: string; alg?: string }>;
  };
  const jwk = jwks.keys?.find(
    (key) =>
      key.kid === header.kid &&
      key.kty === "RSA" &&
      (!key.alg || key.alg === "RS256")
  );
  if (!jwk) throw new Error("jwks_key_not_found");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"]
  );

  const signature = Buffer.from(encodedSignature, "base64url");
  const data = Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8");
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    data
  );
  if (!valid) throw new Error("jwt_signature_rejected");

  return claims;
}

async function refreshGoogleOAuthAccessToken(): Promise<string> {
  const clientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.WAR_ROOM_GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.WAR_ROOM_GOOGLE_CLIENT_SECRET;
  const refreshToken =
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    process.env.WAR_ROOM_GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("gsc_oauth_unconfigured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept-Encoding": "identity",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const body = (await response.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(`oauth_refresh_failed:${body.error ?? response.status}`);
  }
  return body.access_token;
}

function pacificDateDaysAgo(daysAgo: number): string {
  const target = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(target)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  requestBody: Record<string, unknown>
): Promise<SearchAnalyticsResponse> {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      siteUrl
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    }
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `search_console_api_failed:${response.status}:${raw.slice(0, 120)}`
    );
  }
  return raw ? (JSON.parse(raw) as SearchAnalyticsResponse) : {};
}

function normalizeRows(rows: SearchAnalyticsRow[] | undefined) {
  return (rows ?? []).map((row) => ({
    keys: row.keys ?? [],
    clicks: Number(row.clicks ?? 0),
    impressions: Number(row.impressions ?? 0),
    ctr: Number(row.ctr ?? 0),
    position: Number(row.position ?? 0),
  }));
}

async function fetchPeriod(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
) {
  const common = {
    startDate,
    endDate,
    type: "web",
    dataState: "final",
  };

  const [totalRes, queryRes, pageRes, pageQueryRes] = await Promise.all([
    querySearchAnalytics(accessToken, siteUrl, common),
    querySearchAnalytics(accessToken, siteUrl, {
      ...common,
      dimensions: ["query"],
      rowLimit: 25000,
    }),
    querySearchAnalytics(accessToken, siteUrl, {
      ...common,
      dimensions: ["page"],
      rowLimit: 25000,
    }),
    querySearchAnalytics(accessToken, siteUrl, {
      ...common,
      dimensions: ["page", "query"],
      rowLimit: 25000,
    }),
  ]);

  const totalRow = normalizeRows(totalRes.rows)[0] ?? {
    keys: [],
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  };

  return {
    startDate,
    endDate,
    total: {
      clicks: totalRow.clicks,
      impressions: totalRow.impressions,
      ctr: totalRow.ctr,
      position: totalRow.position,
    },
    queries: normalizeRows(queryRes.rows),
    pages: normalizeRows(pageRes.rows),
    pageQueries: normalizeRows(pageQueryRes.rows),
  };
}

async function buildSnapshot(accessToken: string, siteUrl: string) {

  const currentEnd = pacificDateDaysAgo(3);
  const currentStart = pacificDateDaysAgo(16);
  const previousEnd = pacificDateDaysAgo(17);
  const previousStart = pacificDateDaysAgo(30);
  const current28Start = pacificDateDaysAgo(30);

  const [current14, previous14, current28] = await Promise.all([
    fetchPeriod(accessToken, siteUrl, currentStart, currentEnd),
    fetchPeriod(accessToken, siteUrl, previousStart, previousEnd),
    fetchPeriod(accessToken, siteUrl, current28Start, currentEnd),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    siteUrl,
    source: "Google Search Console API via NARU Cloudflare Worker",
    dataState: "final",
    current14,
    previous14,
    current28,
  };
}

function responseHeaders() {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

function normalizeQueryRequest(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  const payload = input as { mode?: unknown; requestBody?: unknown };
  if (payload.mode !== "query" || !payload.requestBody || typeof payload.requestBody !== "object") {
    return null;
  }

  const body = payload.requestBody as Record<string, unknown>;
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("invalid_query_date");
  }

  const dimensions = Array.isArray(body.dimensions)
    ? body.dimensions.filter((value): value is string => typeof value === "string")
    : [];
  if (!dimensions.every((value) => ["query", "page", "date"].includes(value))) {
    throw new Error("invalid_query_dimension");
  }

  const rowLimitRaw = Number(body.rowLimit ?? 1000);
  const rowLimit = Math.max(1, Math.min(25000, Number.isFinite(rowLimitRaw) ? Math.trunc(rowLimitRaw) : 1000));

  let dimensionFilterGroups: unknown = undefined;
  if (body.dimensionFilterGroups !== undefined) {
    if (!Array.isArray(body.dimensionFilterGroups) || body.dimensionFilterGroups.length > 4) {
      throw new Error("invalid_query_filters");
    }
    for (const group of body.dimensionFilterGroups as Array<{ filters?: unknown }>) {
      if (!Array.isArray(group?.filters) || group.filters.length > 4) throw new Error("invalid_query_filters");
      for (const filter of group.filters as Array<Record<string, unknown>>) {
        if (filter.dimension !== "query" || filter.operator !== "equals" || typeof filter.expression !== "string") {
          throw new Error("invalid_query_filter");
        }
        if (filter.expression.length > 300) throw new Error("invalid_query_filter");
      }
    }
    dimensionFilterGroups = body.dimensionFilterGroups;
  }

  return {
    startDate,
    endDate,
    dimensions,
    rowLimit,
    type: "web",
    dataState: "final",
    ...(dimensionFilterGroups ? { dimensionFilterGroups } : {}),
  };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: responseHeaders() }
    );
  }

  try {
    await verifyGitHubOidc(authHeader.slice("Bearer ".length).trim());
  } catch {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: responseHeaders() }
    );
  }

  try {
    const siteUrl =
      process.env.SEARCH_CONSOLE_SITE_URL || "sc-domain:naru-career.com";
    const accessToken = await refreshGoogleOAuthAccessToken();
    const payload = await request.json().catch(() => null);
    const queryRequest = normalizeQueryRequest(payload);

    if (queryRequest) {
      const result = await querySearchAnalytics(accessToken, siteUrl, queryRequest);
      return NextResponse.json(result, {
        status: 200,
        headers: responseHeaders(),
      });
    }

    const snapshot = await buildSnapshot(accessToken, siteUrl);
    return NextResponse.json(snapshot, {
      status: 200,
      headers: responseHeaders(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeCode = message.startsWith("gsc_oauth_unconfigured")
      ? "gsc_oauth_unconfigured"
      : message.startsWith("oauth_refresh_failed")
        ? "gsc_oauth_refresh_failed"
        : message.startsWith("search_console_api_failed")
          ? "gsc_api_failed"
          : "gsc_snapshot_failed";

    return NextResponse.json(
      { error: safeCode },
      { status: 503, headers: responseHeaders() }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "method_not_allowed" },
    { status: 405, headers: responseHeaders() }
  );
}
