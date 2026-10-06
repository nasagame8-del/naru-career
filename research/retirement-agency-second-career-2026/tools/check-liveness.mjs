#!/usr/bin/env node
/**
 * Observable, reproducible facts about each candidate service:
 *   - does the official site respond today, and with what status
 *   - where does it redirect to
 *   - what does the <title> say
 *   - does the Wayback Machine hold a 2024 and a 2025 snapshot
 *
 * This deliberately does NOT decide whether a service is dead. A 404 or an
 * expired domain is recorded as exactly that; the ACTIVE/STOPPED/BANKRUPT
 * call is made later from these observations plus documentary evidence, per
 * reports/methodology.md. Nothing here is allowed to imply bankruptcy.
 *
 * Usage: node tools/check-liveness.mjs [--dir <research dir>] [--concurrency 4]
 */
import fs from 'node:fs';
import path from 'node:path';

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const DIR = path.resolve(argOf('--dir', 'research/retirement-agency-second-career-2026'));
const CONCURRENCY = Number(argOf('--concurrency', '4'));
const UA = 'NARUResearch/1.0 (+https://naru-career.com/; retirement-agency market research)';
const TIMEOUT_MS = 20_000;
const HOST_GAP_MS = 2_000;

// --- csv (same dialect as merge-discovered.mjs) ----------------------------

function parseCsv(str) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  const s = str.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false; } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}
function readCsvObjects(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const csvEscape = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function writeCsv(file, columns, rows) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvEscape(r[c])).join(','));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `﻿${lines.join('\n')}\n`, 'utf8');
}

// --- polite fetching -------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hostGates = new Map();
async function withHostGate(host, fn) {
  const prev = hostGates.get(host) ?? Promise.resolve();
  let release;
  const next = new Promise((r) => { release = r; });
  hostGates.set(host, prev.then(() => next));
  await prev;
  try { return await fn(); } finally { setTimeout(release, HOST_GAP_MS); }
}

/** Classify a transport error without ever implying a business outcome. */
function errorLabel(e) {
  const name = e?.name ?? 'Error';
  const code = e?.cause?.code ?? '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `dns_not_resolved:${code}`;
  if (code === 'ECONNREFUSED') return 'connection_refused';
  if (code === 'ECONNRESET') return 'connection_reset';
  if (/CERT|SSL|TLS/i.test(code)) return `tls_error:${code}`;
  if (name === 'TimeoutError' || name === 'AbortError') return 'timeout';
  return code ? `${name}:${code}` : name;
}

async function headOrGet(url) {
  const out = {
    requested_url: url, http_status: null, final_url: null, redirect_count: 0,
    page_title: null, fetch_error: null, content_length: null,
  };
  let current = url;
  for (let hop = 0; hop <= 5; hop += 1) {
    let host;
    try { host = new URL(current).hostname; } catch { out.fetch_error = 'invalid_url'; return out; }
    let res;
    try {
      res = await withHostGate(host, () => fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'ja,en;q=0.5' },
      }));
    } catch (e) {
      out.fetch_error = errorLabel(e);
      out.final_url = current;
      return out;
    }
    out.http_status = res.status;
    out.final_url = current;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      try { await res.body?.cancel(); } catch { /* ignore */ }
      if (!loc) { out.fetch_error = `redirect_without_location:${res.status}`; return out; }
      try { current = new URL(loc, current).toString(); } catch { out.fetch_error = 'invalid_redirect_target'; return out; }
      out.redirect_count = hop + 1;
      continue;
    }
    if (res.status !== 200) { try { await res.body?.cancel(); } catch { /* ignore */ } return out; }
    let html = '';
    try {
      const buf = Buffer.from(await res.arrayBuffer());
      out.content_length = buf.length;
      html = buf.toString('utf8');
    } catch (e) {
      out.fetch_error = `body_read_failed:${errorLabel(e)}`;
      return out;
    }
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (m) out.page_title = m[1].replace(/\s+/g, ' ').trim().slice(0, 200);
    return out;
  }
  out.fetch_error = 'too_many_redirects';
  return out;
}

/**
 * Wayback Availability API: presence only, never inferred.
 *
 * Asked about a deep campaign URL the API usually answers "no snapshot" even
 * when the service's homepage is archived every month, so callers pass the
 * site root. One retry, because a single flaky call would otherwise read as
 * "this service has no history".
 */
async function wayback(url, timestamp) {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${timestamp}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await withHostGate('archive.org', () => fetch(api, {
        signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': UA },
      }));
      if (res.status !== 200) {
        if (attempt === 0) { await sleep(3_000); continue; }
        return { url: null, timestamp: null, note: `http_${res.status}` };
      }
      const j = await res.json();
      const c = j?.archived_snapshots?.closest;
      if (!c?.available) return { url: null, timestamp: null, note: 'no_snapshot' };
      return { url: c.url ?? null, timestamp: c.timestamp ?? null, note: null };
    } catch (e) {
      if (attempt === 0) { await sleep(3_000); continue; }
      return { url: null, timestamp: null, note: errorLabel(e) };
    }
  }
  return { url: null, timestamp: null, note: 'unreachable' };
}

/** Site root for archive lookups: scheme + host, no path. */
function siteRoot(url) {
  try { const u = new URL(url); return `${u.protocol}//${u.hostname}/`; } catch { return url; }
}

/** Snapshot must actually fall in the requested year, or it is not evidence. */
const yearOf = (ts) => (ts && /^\d{4}/.test(ts) ? ts.slice(0, 4) : null);

async function runPool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try { results[i] = await worker(items[i], i); } catch (e) {
        results[i] = { __error: errorLabel(e), item: items[i] };
      }
    }
  }));
  return results;
}

/** Same name-based join as build-normalized: ids are not stable across runs. */
function nameKeyLocal(raw) {
  if (!raw) return '';
  let s = String(raw)
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ').trim().toLowerCase();
  s = s.replace(/[（(][^）)]*[）)]/g, '').replace(/【[^】]*】/g, '');
  s = s.replace(/の退職代行(サービス)?$/u, '').replace(/退職代行(サービス)?/gu, '');
  s = s.replace(/[\s\-–—_・/|]+/g, '').replace(/サービス$/u, '');
  return s;
}

async function main() {
  const candidates = readCsvObjects(path.join(DIR, 'normalized', 'service_candidates.csv'))
    .filter((c) => c.in_scope === 'true');

  // Services the comparison sweep only reached through affiliate redirects got
  // their real URL from the separate discovery pass; fold those in so they are
  // not left permanently unchecked (and therefore permanently UNKNOWN).
  const discovered = new Map();
  for (const d of readCsvObjects(path.join(DIR, 'raw', 'url_discovery.csv'))) {
    const k = nameKeyLocal(d.service_name);
    if (k && d.official_url) discovered.set(k, d.official_url);
  }
  for (const c of candidates) {
    if (c.service_url || c.domains) continue;
    const found = [c.service_name, ...(c.name_variants ? c.name_variants.split(' | ') : [])]
      .map((n) => discovered.get(nameKeyLocal(n))).find(Boolean);
    if (found) { c.service_url = found; c.__from_discovery = 'true'; }
  }

  const targets = candidates.filter((c) => c.service_url || c.domains);
  process.stderr.write(`${candidates.length} in-scope services, ${targets.length} with a URL to check\n`);

  let done = 0;
  const rows = await runPool(targets, CONCURRENCY, async (c) => {
    // Comparison sites write URLs bare ("taisyokudaikou.com"), so a raw
    // service_url is not necessarily a parseable URL. Add the scheme before use.
    const raw = c.service_url || c.domains.split(' | ')[0];
    const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
    let live = await headOrGet(base);

    // Comparison sites often link a campaign subdomain (lp.example.jp). When
    // that host is gone the service itself may be perfectly alive at its apex,
    // and counting it as dead would overstate how much of the market vanished.
    // One fallback only, and the fact that we fell back is recorded.
    let fallbackFrom = '';
    const transportFailed = live.fetch_error && /^(dns_not_resolved|connection_|tls_error|timeout)/.test(live.fetch_error);
    if (transportFailed) {
      let apex = '';
      try {
        const h = new URL(base).hostname.replace(/^www\./, '');
        const parts = h.split('.');
        const jpSecond = new Set(['co', 'or', 'ne', 'ac', 'go', 'lg', 'gr', 'ed']);
        const keep = (parts.length >= 3 && parts.at(-1) === 'jp' && jpSecond.has(parts.at(-2))) ? 3 : 2;
        if (parts.length > keep) apex = parts.slice(-keep).join('.');
      } catch { /* leave apex empty */ }
      if (apex) {
        const alt = await headOrGet(`https://${apex}/`);
        if (alt.http_status === 200) { fallbackFrom = base; live = alt; }
      }
    }
    const archiveTarget = siteRoot(base);
    const a24 = await wayback(archiveTarget, '20240601');
    const a25 = await wayback(archiveTarget, '20250601');
    done += 1;
    process.stderr.write(`[${done}/${targets.length}] ${String(live.http_status ?? live.fetch_error).padEnd(22)} ${c.service_name}\n`);
    return {
      service_id: c.service_id,
      service_name: c.service_name,
      checked_url: live.requested_url,
      apex_fallback_from: fallbackFrom,
      http_status: live.http_status ?? '',
      final_url: live.final_url ?? '',
      redirect_count: live.redirect_count,
      page_title: live.page_title ?? '',
      content_length: live.content_length ?? '',
      fetch_error: live.fetch_error ?? '',
      // website_alive is a narrow, literal claim: the URL answered 200 today.
      website_alive: live.http_status === 200 ? 'true' : (live.fetch_error || live.http_status ? 'false' : ''),
      archive_2024_url: yearOf(a24.timestamp) === '2024' ? a24.url : '',
      archive_2024_timestamp: yearOf(a24.timestamp) === '2024' ? a24.timestamp : '',
      archive_2024_note: yearOf(a24.timestamp) === '2024' ? '' : (a24.note ?? `closest_is_${a24.timestamp ?? 'none'}`),
      archive_2025_url: yearOf(a25.timestamp) === '2025' ? a25.url : '',
      archive_2025_timestamp: yearOf(a25.timestamp) === '2025' ? a25.timestamp : '',
      archive_2025_note: yearOf(a25.timestamp) === '2025' ? '' : (a25.note ?? `closest_is_${a25.timestamp ?? 'none'}`),
      checked_at: new Date().toISOString(),
    };
  });

  writeCsv(path.join(DIR, 'raw', 'liveness_checks.csv'), [
    'service_id', 'service_name', 'checked_url', 'apex_fallback_from', 'http_status', 'final_url', 'redirect_count',
    'page_title', 'content_length', 'fetch_error', 'website_alive',
    'archive_2024_url', 'archive_2024_timestamp', 'archive_2024_note',
    'archive_2025_url', 'archive_2025_timestamp', 'archive_2025_note', 'checked_at',
  ], rows);

  const byStatus = {};
  for (const r of rows) {
    const k = r.http_status || r.fetch_error || 'unknown';
    byStatus[k] = (byStatus[k] ?? 0) + 1;
  }
  console.log(JSON.stringify({
    inScopeServices: candidates.length,
    checked: rows.length,
    notCheckedBecauseNoUrl: candidates.length - targets.length,
    httpOutcomes: byStatus,
    respond200: rows.filter((r) => r.website_alive === 'true').length,
    with2024Snapshot: rows.filter((r) => r.archive_2024_url).length,
    with2025Snapshot: rows.filter((r) => r.archive_2025_url).length,
  }, null, 2));
}

main();
