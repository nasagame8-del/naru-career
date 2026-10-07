/**
 * Shared Google Search Console auth/query helper for NARU data jobs.
 *
 * OAuth is preferred. Service-account auth remains only as a backwards-compatible
 * fallback for environments where it already exists.
 */

export function getSearchConsoleSiteUrl() {
  return process.env.SEARCH_CONSOLE_SITE_URL || "sc-domain:naru-career.com";
}

async function refreshOAuthAccessToken(clientId, clientSecret, refreshToken) {
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
  });

  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Google OAuth refresh failed: ${body.error ?? response.status}${
        body.error_description ? ` ${body.error_description}` : ""
      }`
    );
  }
  return body.access_token;
}

export async function resolveSearchConsoleAuth() {
  const oauthClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.WAR_ROOM_GOOGLE_CLIENT_ID;
  const oauthClientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.WAR_ROOM_GOOGLE_CLIENT_SECRET;
  const oauthRefreshToken =
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN || process.env.WAR_ROOM_GOOGLE_REFRESH_TOKEN;

  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    return {
      kind: "oauth",
      accessToken: await refreshOAuthAccessToken(
        oauthClientId,
        oauthClientSecret,
        oauthRefreshToken
      ),
    };
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && privateKey) {
    const { google } = await import("googleapis");
    return {
      kind: "jwt",
      client: new google.auth.JWT({
        email,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      }),
    };
  }

  throw new Error(
    "Search Console auth is not configured. Set Google OAuth client ID/secret/refresh token."
  );
}

export async function querySearchAnalytics(auth, siteUrl, requestBody) {
  if (auth.kind === "oauth") {
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        siteUrl
      )}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
          "Accept-Encoding": "identity",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `Search Console API ${response.status}: ${raw.slice(0, 240)}`
      );
    }
    return raw ? JSON.parse(raw) : {};
  }

  const { google } = await import("googleapis");
  const searchconsole = google.searchconsole({ version: "v1", auth: auth.client });
  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody,
  });
  return response.data ?? {};
}

export function pacificDateDaysAgo(daysAgo) {
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
