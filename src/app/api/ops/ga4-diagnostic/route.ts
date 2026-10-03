import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type AccountSummariesResponse = {
  accountSummaries?: Array<{
    name?: string;
    account?: string;
    displayName?: string;
    propertySummaries?: Array<{
      property?: string;
      displayName?: string;
      propertyType?: string;
      parent?: string;
    }>;
  }>;
};

async function getAccessToken() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth environment variables are missing");
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

  const body = (await response.json()) as TokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error(
      `OAuth refresh failed: ${body.error ?? response.status}${
        body.error_description ? ` ${body.error_description}` : ""
      }`
    );
  }
  return body.access_token;
}

async function fetchAccountSummaries(accessToken: string) {
  const response = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Accept-Encoding": "identity",
      },
      cache: "no-store",
    }
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Analytics Admin API ${response.status}: ${raw.slice(0, 500)}`);
  }
  return raw ? (JSON.parse(raw) as AccountSummariesResponse) : {};
}

async function testDataApi(propertyId: string, accessToken: string) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      }),
      cache: "no-store",
    }
  );

  const raw = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: raw.slice(0, 500),
    };
  }

  const json = raw ? JSON.parse(raw) : {};
  const row = json.rows?.[0];
  return {
    ok: true,
    status: response.status,
    users7d: Number(row?.metricValues?.[0]?.value || 0),
    pv7d: Number(row?.metricValues?.[1]?.value || 0),
  };
}

export async function GET(request: NextRequest) {
  const expected = process.env.GA4_DIAGNOSTIC_SECRET;
  const provided = request.headers.get("x-ga4-diagnostic-secret");
  if (!expected || !provided || provided !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const accessToken = await getAccessToken();
    const summaries = await fetchAccountSummaries(accessToken);
    const properties = (summaries.accountSummaries ?? []).flatMap((account) =>
      (account.propertySummaries ?? []).map((property) => ({
        account: account.account ?? account.name ?? "",
        accountDisplayName: account.displayName ?? "",
        property: property.property ?? "",
        propertyId: (property.property ?? "").replace(/^properties\//, ""),
        displayName: property.displayName ?? "",
        propertyType: property.propertyType ?? "",
      }))
    );

    const configuredPropertyId = process.env.GA4_PROPERTY_ID ?? "";
    const dataApi = configuredPropertyId
      ? await testDataApi(configuredPropertyId, accessToken)
      : null;

    return NextResponse.json(
      {
        oauth: true,
        configuredPropertyId: configuredPropertyId || null,
        propertyCount: properties.length,
        properties,
        dataApi,
        error: null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        oauth: false,
        configuredPropertyId: process.env.GA4_PROPERTY_ID ?? null,
        propertyCount: 0,
        properties: [],
        dataApi: null,
        error: message.slice(0, 800),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
