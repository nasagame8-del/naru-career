import { createSign } from "node:crypto";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const MAX_CONTEXT_CHARS = 14000;
const MAX_DIRECT_CHILDREN = 30;
const MAX_SAMPLE_FOLDERS = 6;
const MAX_FILES_PER_FOLDER = 3;
const MAX_FILE_CHARS = 3500;

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

interface DriveListResponse {
  files?: DriveFile[];
  nextPageToken?: string;
}

export interface DriveContextResult {
  linksFound: number;
  context: string;
  warning?: string;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function readCredentials(): ServiceAccountCredentials | null {
  const raw = process.env.WAR_ROOM_GOOGLE_CREDENTIALS;
  if (!raw) return null;

  const decoded = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");

  const parsed = JSON.parse(decoded) as ServiceAccountCredentials;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Google Drive credentials are incomplete");
  }
  return parsed;
}

async function getOAuthRefreshAccessToken(): Promise<string | null> {
  const clientId = process.env.WAR_ROOM_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.WAR_ROOM_GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.WAR_ROOM_GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    throw new Error(`Google OAuth refresh failed: ${body.error ?? response.status}`);
  }
  return body.access_token;
}

async function getWorkloadIdentityAccessToken(vercelOidcToken?: string): Promise<string | null> {
  const projectNumber = process.env.WAR_ROOM_GCP_PROJECT_NUMBER;
  const poolId = process.env.WAR_ROOM_GCP_POOL_ID;
  const providerId = process.env.WAR_ROOM_GCP_PROVIDER_ID;
  const serviceAccountEmail = process.env.WAR_ROOM_GCP_SERVICE_ACCOUNT_EMAIL;

  if (!vercelOidcToken || !projectNumber || !poolId || !providerId || !serviceAccountEmail) {
    return null;
  }

  const audience =
    `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;

  const stsResponse = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: vercelOidcToken,
    }),
    cache: "no-store",
  });

  const stsBody = (await stsResponse.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!stsResponse.ok || !stsBody.access_token) {
    throw new Error(`Google STS exchange failed: ${stsBody.error ?? stsResponse.status}`);
  }

  const impersonationResponse = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}:generateAccessToken`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stsBody.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scope: [DRIVE_SCOPE],
        lifetime: "3600s",
      }),
      cache: "no-store",
    }
  );

  const impersonationBody = (await impersonationResponse.json()) as {
    accessToken?: string;
    error?: { message?: string };
  };
  if (!impersonationResponse.ok || !impersonationBody.accessToken) {
    throw new Error(
      `Google service account impersonation failed: ${impersonationBody.error?.message ?? impersonationResponse.status}`
    );
  }

  return impersonationBody.accessToken;
}

async function getAccessToken(vercelOidcToken?: string): Promise<string> {
  const workloadToken = await getWorkloadIdentityAccessToken(vercelOidcToken);
  if (workloadToken) return workloadToken;

  const oauthToken = await getOAuthRefreshAccessToken();
  if (oauthToken) return oauthToken;

  const credentials = readCredentials();
  if (!credentials) throw new Error("Google Drive credentials are not configured");

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: DRIVE_SCOPE,
      aud: credentials.token_uri || TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(credentials.private_key));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(credentials.token_uri || TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  const body = (await response.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(`Google OAuth failed: ${body.error ?? response.status}`);
  }
  return body.access_token;
}

export function extractDriveTargets(text: string): Array<{ id: string; kind: "file" | "folder" }> {
  const targets: Array<{ id: string; kind: "file" | "folder" }> = [];
  const seen = new Set<string>();

  const patterns: Array<{ regex: RegExp; kind: "file" | "folder" }> = [
    { regex: /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/g, kind: "folder" },
    { regex: /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/g, kind: "file" },
    { regex: /docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/g, kind: "file" },
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      const id = match[1];
      if (!seen.has(id)) {
        seen.add(id);
        targets.push({ id, kind: pattern.kind });
      }
    }
  }

  return targets.slice(0, 3);
}

async function driveJson<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${DRIVE_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Google Drive API failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function getFile(token: string, id: string): Promise<DriveFile> {
  const fields = encodeURIComponent("id,name,mimeType,modifiedTime,size,webViewLink");
  return driveJson<DriveFile>(token, `/files/${encodeURIComponent(id)}?fields=${fields}&supportsAllDrives=true`);
}

async function listChildren(token: string, folderId: string, pageSize = MAX_DIRECT_CHILDREN): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: String(pageSize),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const result = await driveJson<DriveListResponse>(token, `/files?${params.toString()}`);
  return result.files ?? [];
}

function isReadableText(file: DriveFile): boolean {
  return (
    file.mimeType === DOC_MIME ||
    file.mimeType === SHEET_MIME ||
    file.mimeType.startsWith("text/") ||
    file.mimeType === "application/json" ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".csv") ||
    file.name.endsWith(".json")
  );
}

async function readFileText(token: string, file: DriveFile): Promise<string> {
  let url: string;
  if (file.mimeType === DOC_MIME) {
    url = `${DRIVE_API}/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent("text/plain")}`;
  } else if (file.mimeType === SHEET_MIME) {
    url = `${DRIVE_API}/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent("text/csv")}`;
  } else {
    url = `${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return "";
  return (await response.text()).slice(0, MAX_FILE_CHARS);
}

async function summarizeFolder(token: string, folder: DriveFile): Promise<string> {
  const children = await listChildren(token, folder.id);
  const lines = [
    `## Drive folder: ${folder.name}`,
    ...children.map((child) => `- ${child.mimeType === FOLDER_MIME ? "[folder]" : "[file]"} ${child.name}`),
  ];

  const directReadable = children.filter((child) => isReadableText(child)).slice(0, 8);
  for (const file of directReadable) {
    const text = await readFileText(token, file);
    if (text) lines.push(`\n### ${file.name}\n${text}`);
  }

  const childFolders = children.filter((child) => child.mimeType === FOLDER_MIME).slice(0, MAX_SAMPLE_FOLDERS);
  for (const childFolder of childFolders) {
    const nested = await listChildren(token, childFolder.id, 12);
    lines.push(`\n### Folder sample: ${childFolder.name}`);
    lines.push(...nested.map((file) => `- ${file.name}`));

    for (const file of nested.filter((item) => isReadableText(item)).slice(0, MAX_FILES_PER_FOLDER)) {
      const text = await readFileText(token, file);
      if (text) lines.push(`\n#### ${childFolder.name} / ${file.name}\n${text}`);
    }
  }

  return lines.join("\n").slice(0, MAX_CONTEXT_CHARS);
}

async function summarizeTarget(token: string, id: string): Promise<string> {
  const file = await getFile(token, id);
  if (file.mimeType === FOLDER_MIME) return summarizeFolder(token, file);
  if (!isReadableText(file)) {
    return `## Drive file: ${file.name}\nThis file type is not text-readable by War Room yet (${file.mimeType}).`;
  }
  const text = await readFileText(token, file);
  return `## Drive file: ${file.name}\n${text}`;
}

export async function buildDriveContextFromText(
  text: string,
  options: { vercelOidcToken?: string } = {}
): Promise<DriveContextResult> {
  const targets = extractDriveTargets(text);
  if (targets.length === 0) return { linksFound: 0, context: "" };

  const hasWorkloadIdentity =
    Boolean(options.vercelOidcToken) &&
    Boolean(process.env.WAR_ROOM_GCP_PROJECT_NUMBER) &&
    Boolean(process.env.WAR_ROOM_GCP_POOL_ID) &&
    Boolean(process.env.WAR_ROOM_GCP_PROVIDER_ID) &&
    Boolean(process.env.WAR_ROOM_GCP_SERVICE_ACCOUNT_EMAIL);

  const hasOAuth =
    Boolean(process.env.WAR_ROOM_GOOGLE_CLIENT_ID) &&
    Boolean(process.env.WAR_ROOM_GOOGLE_CLIENT_SECRET) &&
    Boolean(process.env.WAR_ROOM_GOOGLE_REFRESH_TOKEN);

  if (!hasWorkloadIdentity && !hasOAuth && !process.env.WAR_ROOM_GOOGLE_CREDENTIALS) {
    return {
      linksFound: targets.length,
      context: "",
      warning: "Google Drive read access is not configured for War Room.",
    };
  }

  try {
    const token = await getAccessToken(options.vercelOidcToken);
    const chunks: string[] = [];
    for (const target of targets) {
      chunks.push(await summarizeTarget(token, target.id));
    }
    return {
      linksFound: targets.length,
      context: chunks.join("\n\n").slice(0, MAX_CONTEXT_CHARS),
    };
  } catch {
    return {
      linksFound: targets.length,
      context: "",
      warning: "Google Drive link was detected, but War Room could not read it.",
    };
  }
}
