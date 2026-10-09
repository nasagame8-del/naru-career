/**
 * Shared, deliberately conservative web-research helpers for the NARU
 * Shokuba Rabo research pipeline (stage 4 discovery, stage 5 job extraction).
 *
 * Non-negotiables implemented here, not left to callers:
 * - robots.txt is fetched per origin and honoured on every redirect hop
 * - one in-flight request per host, with a fixed gap between same-host requests
 * - no login, no CAPTCHA/anti-bot bypass, no JavaScript automation
 * - no URL brute-forcing: callers may only pass URLs that were found in a page,
 *   in a sitemap, or in the provider dataset
 * - response size cap, HTML/XML only, page bodies never persisted by callers
 * - 403/404/429/5xx are outcomes to record, never something to retry around
 *
 * `scripts/research-recruitment-pages.mjs` (stage 2) predates this module and
 * is kept self-contained as the frozen pilot crawler; it is not refactored onto
 * this module so that its committed output stays reproducible.
 */
import fs from 'node:fs';
import path from 'node:path';

export const USER_AGENT = 'NARUResearch/1.0 (+https://naru-career.com/; public recruitment-page research)';
export const ROBOTS_UA_TOKEN = 'naruresearch';
export const DEFAULTS = {
  timeoutMs: 20_000,
  sameHostDelayMs: 1_500,
  maxBytes: 2_000_000,
  maxRedirects: 5,
  maxAttempts: 2,
  maxCrawlDelaySeconds: 10,
};

/** Third-party job boards / aggregators: recorded as a fact, never crawled across. */
export const JOB_PLATFORM_DOMAINS = [
  'indeed.com', 'jp.indeed.com', 'wantedly.com', 'doda.jp', 'mynavi.jp', 'rikunabi.com',
  'type.jp', 'green-japan.com', 'bizreach.jp', 'openwork.jp', 'jobtalk.jp', 'en-japan.com',
  'enjapan.com', 'xn--pckua2a7gp15o89zb.com', 'kyujinbox.com', 'baitoru.com', 'townwork.net',
  'levtech.jp', 'paiza.jp', 'forkwell.com', 'findy-code.io', 'geekly.co.jp', 'hatalike.jp',
  'job-medley.com', 'shigoto.mhlw.go.jp', 'hellowork.mhlw.go.jp', 'careercross.com',
  'daijob.com', 'linkedin.com', 'glassdoor.com', 'lancers.jp', 'crowdworks.jp',
  'career-tasu.jp', 'onecareer.jp', 'jobrass.com', 'syukatsu-kaigi.jp',
  'gaishishukatsu.com', 'shukatsu-note.com', 'job.mynavi.jp', 'tenshoku.mynavi.jp',
  'next.rikunabi.com', 'rikunabi-next.com', 'jobtalk.co.jp', 'kyujin.town',
];

/** Recruiting SaaS / ATS: the company's own posting, hosted elsewhere. */
export const ATS_DOMAINS = [
  'herp.careers', 'hrmos.co', 'talentio.com', 'recruitee.com', 'en-gage.net',
  'jobs.gluegent.net', 'workable.com', 'greenhouse.io', 'lever.co', 'smarthr.jp',
  'jobcan-ats.jp', 'recme.jp', 'jinjer.jp', 'airwork.net', 'recruitment-cloud.jp',
  'careerplus.jp', 'ashby.hq', 'jobs.ashbyhq.com', 'join.com', 'engage-jp.com',
  'i-web.jp', 'jobcan.jp', 'sonar-ats.jp', 'mochica.jp', 'recruiting-board.jp',
  'jinji-navi.jp', 'rec-tech.jp', 'saiyo-kanri.jp', 'recruit-page.com',
];

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function parseCsv(str) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i += 1) {
    const c = str[i];
    if (inQuotes) {
      if (c === '"') {
        if (str[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* normalised away */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function readCsvObjects(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(text);
  const headers = rows[0];
  return rows.slice(1)
    .filter((r) => r.length === headers.length)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

export function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join(' | ') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeCsv(file, columns, rows) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvEscape(r[c])).join(','));
  fs.writeFileSync(file, `﻿${lines.join('\n')}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// hosts
// ---------------------------------------------------------------------------

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

/** Crude registrable-domain guess; good enough for same-company comparison. */
export function registrableDomain(host) {
  if (!host) return null;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const twoLevel = new Set(['co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp', 'gr.jp', 'lg.jp', 'com.cn', 'co.uk', 'com.au']);
  if (twoLevel.has(parts.slice(-2).join('.'))) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

export function domainMatches(host, list) {
  if (!host) return false;
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

export const isJobPlatform = (host) => !domainMatches(host, ATS_DOMAINS) && domainMatches(host, JOB_PLATFORM_DOMAINS);
export const isAts = (host) => domainMatches(host, ATS_DOMAINS);

export function classifyHost(targetUrl, homepageUrl) {
  const host = hostOf(targetUrl);
  if (!host) return 'unknown';
  if (isAts(host)) return 'atsHosted';
  if (isJobPlatform(host)) return 'jobPlatform';
  const hp = hostOf(homepageUrl);
  if (hp && registrableDomain(host) === registrableDomain(hp)) return 'ownDomain';
  return 'otherDomain';
}

// ---------------------------------------------------------------------------
// HTML / JSON-LD
// ---------------------------------------------------------------------------

export function decodeBody(buf, contentType) {
  const candidates = [];
  const fromHeader = contentType && /charset=([^;\s]+)/i.exec(contentType);
  if (fromHeader) candidates.push(fromHeader[1].replace(/['"]/g, ''));
  const head = Buffer.from(buf.subarray(0, 4096)).toString('latin1');
  const fromMeta = /<meta[^>]+charset=["']?([^"'\s/>]+)/i.exec(head);
  if (fromMeta) candidates.push(fromMeta[1]);
  const fromXml = /<\?xml[^>]+encoding=["']([^"']+)["']/i.exec(head);
  if (fromXml) candidates.push(fromXml[1]);
  candidates.push('utf-8', 'shift_jis', 'euc-jp');
  for (const enc of candidates) {
    try { return new TextDecoder(enc.trim().toLowerCase(), { fatal: true }).decode(buf); } catch { /* next */ }
  }
  return new TextDecoder('utf-8').decode(buf);
}

export function decodeEntities(s) {
  return s.replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(Number(d)); } catch { return ' '; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ' '; } });
}

export function stripToVisibleText(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

export function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  if (!m) return null;
  const t = stripToVisibleText(m[1]);
  return t ? t.slice(0, 500) : null;
}

export function extractHeadings(html, max = 5) {
  const out = [];
  const re = /<h([12])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null && out.length < max) {
    const t = stripToVisibleText(m[2]);
    if (t) out.push(t.slice(0, 200));
  }
  return out;
}

/** All http(s) anchors with their visible text, absolutised against baseUrl. */
export function extractAnchors(html, baseUrl) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(m[1]);
    if (!hrefMatch) continue;
    const raw = (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '').trim();
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw)) continue;
    let abs;
    try { abs = new URL(decodeEntities(raw), baseUrl); } catch { continue; }
    if (!/^https?:$/.test(abs.protocol)) continue;
    abs.hash = '';
    const text = stripToVisibleText(m[2]).slice(0, 200);
    const titleAttr = /title\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[1]);
    const altAttr = /alt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[2]);
    out.push({
      url: abs.toString(),
      text,
      label: text || decodeEntities(titleAttr?.[2] ?? titleAttr?.[3] ?? altAttr?.[2] ?? altAttr?.[3] ?? '').trim().slice(0, 200),
    });
  }
  return out;
}

export function extractJsonLdBlocks(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

export function* walkJson(node) {
  if (Array.isArray(node)) {
    for (const v of node) yield* walkJson(v);
  } else if (node && typeof node === 'object') {
    yield node;
    for (const v of Object.values(node)) yield* walkJson(v);
  }
}

export function asText(v, limit = 600) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') { const t = decodeEntities(v).replace(/\s+/g, ' ').trim(); return t ? t.slice(0, limit) : null; }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    const parts = v.map((x) => asText(x, limit)).filter(Boolean);
    return parts.length ? parts.join(' | ').slice(0, limit) : null;
  }
  if (typeof v === 'object') {
    for (const k of ['name', 'value', 'title', 'description', 'text']) {
      if (v[k] !== undefined) { const t = asText(v[k], limit); if (t) return t; }
    }
    return null;
  }
  return null;
}

export function numberOrNull(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = /-?\d[\d,]*(?:\.\d+)?/.exec(v);
    if (m) { const n = Number(m[0].replace(/,/g, '')); return Number.isFinite(n) ? n : null; }
  }
  return null;
}

function parseJsonLdSalary(baseSalary) {
  const out = { salaryMin: null, salaryMax: null, salaryCurrency: null, salaryUnit: null };
  if (!baseSalary || typeof baseSalary !== 'object') return out;
  for (const node of (Array.isArray(baseSalary) ? baseSalary : [baseSalary])) {
    if (!node || typeof node !== 'object') continue;
    out.salaryCurrency = out.salaryCurrency ?? asText(node.currency, 10);
    const v = node.value;
    if (v && typeof v === 'object') {
      out.salaryMin = out.salaryMin ?? numberOrNull(v.minValue) ?? numberOrNull(v.value);
      out.salaryMax = out.salaryMax ?? numberOrNull(v.maxValue) ?? numberOrNull(v.value);
      out.salaryUnit = out.salaryUnit ?? asText(v.unitText, 20);
    } else {
      out.salaryMin = out.salaryMin ?? numberOrNull(v);
      out.salaryMax = out.salaryMax ?? numberOrNull(v);
    }
  }
  return out;
}

function jsonLdLocation(jobLocation) {
  const parts = [];
  for (const n of (Array.isArray(jobLocation) ? jobLocation : [jobLocation])) {
    if (!n || typeof n !== 'object') { const t = asText(n, 120); if (t) parts.push(t); continue; }
    const addr = n.address ?? n;
    if (addr && typeof addr === 'object') {
      const t = [addr.addressRegion, addr.addressLocality, addr.streetAddress].map((x) => asText(x, 80)).filter(Boolean).join(' ');
      if (t) { parts.push(t); continue; }
    }
    const t = asText(n, 120);
    if (t) parts.push(t);
  }
  return parts.length ? [...new Set(parts)].join(' | ').slice(0, 200) : null;
}

/** JobPosting records from a page's JSON-LD. Unknown fields stay null. */
export function extractJobPostings(blocks) {
  if (!blocks.length) return { hasJobPosting: false, parseFailed: false, postings: [] };
  const postings = [];
  let parseFailed = false;
  for (const raw of blocks) {
    let data;
    try { data = JSON.parse(raw); } catch { parseFailed = true; continue; }
    for (const node of walkJson(data)) {
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      if (!types.some((t) => typeof t === 'string' && t.toLowerCase() === 'jobposting')) continue;
      postings.push({
        title: asText(node.title, 200),
        occupationalCategory: asText(node.occupationalCategory, 200),
        employmentType: asText(node.employmentType, 100),
        datePosted: asText(node.datePosted, 40),
        validThrough: asText(node.validThrough, 40),
        ...parseJsonLdSalary(node.baseSalary),
        jobLocation: jsonLdLocation(node.jobLocation),
        experienceRequirements: asText(node.experienceRequirements, 300),
        skills: asText(node.skills, 300),
        qualifications: asText(node.qualifications, 300),
        responsibilities: asText(node.responsibilities, 200),
        hiringOrganization: asText(node.hiringOrganization, 120),
        url: asText(node.url, 400),
        directApply: typeof node.directApply === 'boolean' ? node.directApply : null,
      });
    }
  }
  const textHasType = !postings.length && blocks.some((b) => /JobPosting/i.test(b));
  return { hasJobPosting: postings.length > 0 || textHasType, parseFailed, postings };
}

// ---------------------------------------------------------------------------
// block segmentation (offset-preserving, no DOM library available)
// ---------------------------------------------------------------------------

/**
 * Blanks out non-content regions while keeping every byte offset identical, so
 * headings, tables and anchors can be located and sliced against each other.
 */
export function maskNonContent(html) {
  const blank = (m) => ' '.repeat(m.length);
  return html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1\s*>/gi, blank);
}

function cellsOf(rowHtml) {
  return [...rowHtml.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]\s*>/gi)]
    .map((m) => stripToVisibleText(m[1]));
}

/** label/value pairs from a <table>: 2 cells => pair, more => first vs rest. */
function tableRows(inner) {
  const rows = [];
  for (const m of inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    const cells = cellsOf(m[1]).filter((c) => c !== '');
    if (cells.length >= 2) rows.push({ label: cells[0], value: cells.slice(1).join(' ').slice(0, 400) });
    else if (cells.length === 1) rows.push({ label: cells[0], value: null });
  }
  return rows;
}

/** label/value pairs from a <dl>: each <dt> pairs with the <dd>s that follow. */
function defListRows(inner) {
  const rows = [];
  const re = /<(dt|dd)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let current = null;
  for (const m of inner.matchAll(re)) {
    const text = stripToVisibleText(m[2]);
    if (m[1].toLowerCase() === 'dt') {
      if (current) rows.push(current);
      current = { label: text, value: null };
    } else if (current) {
      current.value = [current.value, text].filter(Boolean).join(' ').slice(0, 400);
    }
  }
  if (current) rows.push(current);
  return rows;
}

/**
 * Structural blocks of one page. All offsets refer to the masked HTML returned
 * as `masked`, so callers can slice sections and ask which blocks fall inside.
 */
export function extractBlocks(html) {
  const masked = maskNonContent(html);
  const headings = [];
  for (const m of masked.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)) {
    const text = stripToVisibleText(m[2]);
    if (text) headings.push({ level: Number(m[1]), text: text.slice(0, 200), start: m.index, contentStart: m.index + m[0].length });
  }
  const tables = [];
  for (const m of masked.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)) {
    tables.push({ start: m.index, end: m.index + m[0].length, rows: tableRows(m[1]), kind: 'table' });
  }
  const defLists = [];
  for (const m of masked.matchAll(/<dl\b[^>]*>([\s\S]*?)<\/dl\s*>/gi)) {
    defLists.push({ start: m.index, end: m.index + m[0].length, rows: defListRows(m[1]), kind: 'dl' });
  }
  const anchors = [];
  for (const m of masked.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(m[1]);
    if (!hrefMatch) continue;
    const raw = (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '').trim();
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw)) continue;
    anchors.push({
      href: decodeEntities(raw),
      text: stripToVisibleText(m[2]).slice(0, 200),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return { masked, headings, tables, defLists, anchors };
}

/**
 * A heading's section runs until the next heading at the same or higher level.
 * This is what turns a "all jobs on one page" layout into per-role sections.
 */
export function headingSections(blocks, { maxChars = 4000 } = {}) {
  const { masked, headings } = blocks;
  const sorted = [...headings].sort((a, b) => a.start - b.start);
  return sorted.map((h, i) => {
    let end = masked.length;
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (sorted[j].level <= h.level) { end = sorted[j].start; break; }
    }
    const rawText = stripToVisibleText(masked.slice(h.contentStart, end));
    return {
      level: h.level,
      heading: h.text,
      start: h.contentStart,
      end,
      text: rawText.slice(0, maxChars),
      textLength: rawText.length,
      childHeadings: sorted.filter((x) => x.start > h.start && x.start < end).map((x) => ({ level: x.level, text: x.text })),
    };
  });
}

/** label/value rows of every table and dl that sits inside [start, end). */
export function rowsWithin(blocks, start, end) {
  const out = [];
  for (const b of [...blocks.tables, ...blocks.defLists]) {
    if (b.start >= start && b.start < end) out.push(...b.rows.map((r) => ({ ...r, kind: b.kind })));
  }
  return out;
}

export function anchorsWithin(blocks, start, end) {
  return blocks.anchors.filter((a) => a.start >= start && a.start < end);
}

// ---------------------------------------------------------------------------
// keyword flags
// ---------------------------------------------------------------------------

/** `ascii` = word-boundary + case-sensitive, so "SE" does not match "services". */
export const KEYWORDS = {
  secondNewGrad: [{ p: '第二新卒' }],
  inexperienced: [{ p: '未経験' }, { p: '経験不問' }],
  recentGraduate: [{ p: '既卒' }],
  potentialHire: [{ p: 'ポテンシャル採用' }, { p: 'ポテンシャル人材' }, { p: 'ポテンシャル枠' }, { p: 'ポテンシャル層' }],
  training: [{ p: '研修' }],
  mentor: [{ p: 'メンター' }, { p: 'メンタリング' }],
  remote: [{ p: 'リモート' }, { p: '在宅勤務' }, { p: 'テレワーク' }],
  fullRemote: [{ p: 'フルリモート' }, { p: '完全在宅' }, { p: 'フルリモ' }],
  engineer: [{ p: 'エンジニア' }, { p: 'プログラマ' }, { p: 'システムエンジニア' }, { p: 'SE', ascii: true }, { p: 'PG', ascii: true }],
  webMarketing: [{ p: 'webマーケ', ci: true }, { p: 'デジタルマーケ', ci: true }, { p: 'ネットマーケ', ci: true }],
  webDirector: [{ p: 'webディレク', ci: true }, { p: 'ディレクター職', ci: true }],
  portfolio: [{ p: 'ポートフォリオ' }, { p: 'portfolio', ascii: true, ci: true }],
  practicalExperience: [{ p: '実務経験' }],
  salaryMention: [{ p: '年収' }, { p: '月給' }, { p: '給与' }, { p: '初任給' }, { p: '月額基本給' }],
  newGrad: [{ p: '新卒' }],
  midCareer: [{ p: '中途採用' }, { p: 'キャリア採用' }, { p: '経験者採用' }],
};

const MATCHERS = Object.fromEntries(Object.entries(KEYWORDS).map(([name, specs]) => [
  name,
  specs.map((s) => new RegExp(s.ascii ? `\\b${escapeRe(s.p)}\\b` : escapeRe(s.p), s.ci ? 'i' : '')),
]));

/** Returns { flags, flagTerms } so every true value is auditable later. */
export function matchFlags(text) {
  const flags = {};
  const flagTerms = {};
  for (const [name, specs] of Object.entries(KEYWORDS)) {
    const hits = specs.filter((_, i) => MATCHERS[name][i].test(text)).map((s) => s.p);
    flags[name] = hits.length > 0;
    if (hits.length) flagTerms[name] = hits;
  }
  return { flags, flagTerms };
}

export function nullFlags() {
  return Object.fromEntries(Object.keys(KEYWORDS).map((k) => [k, null]));
}

// ---------------------------------------------------------------------------
// polite fetching
// ---------------------------------------------------------------------------

// --- request accounting and 429 handling -----------------------------------

const requestStats = { requests: 0, byStatus: {}, byError: {}, blockedHosts: [] };
/** A host that answers 429 is dropped for the rest of the run, not retried. */
const blockedHosts = new Set();

export function getRequestStats() {
  return {
    totalHttpRequests: requestStats.requests,
    statusCounts: { ...requestStats.byStatus },
    errorCounts: { ...requestStats.byError },
    hostsBlockedAfter429: [...blockedHosts].sort(),
  };
}

export function isHostBlocked(host) { return blockedHosts.has(host); }

// --- checkpoints ------------------------------------------------------------

/** Write via a temp file + rename so a crash cannot leave a truncated JSON. */
export function atomicWriteFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, file);
}

/** One JSON object per line; a partial last line is dropped on read. */
export function appendCheckpoint(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
}

export function readCheckpoint(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* truncated final line */ }
  }
  return out;
}

const hostGates = new Map();

/** Serialises requests per host and keeps a fixed gap between them. */
export async function withHostGate(host, fn, delayMs = DEFAULTS.sameHostDelayMs) {
  const prev = hostGates.get(host) ?? Promise.resolve();
  let release;
  const current = new Promise((r) => { release = r; });
  hostGates.set(host, prev.then(() => current));
  await prev;
  try {
    return await fn();
  } finally {
    setTimeout(release, delayMs);
  }
}

async function rawFetch(url, timeoutMs) {
  requestStats.requests += 1;
  return fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.1',
      'Accept-Language': 'ja,en;q=0.5',
    },
  });
}

async function readCapped(res, maxBytes) {
  if (!res.body) return { buf: Buffer.alloc(0), truncated: false };
  const chunks = [];
  let total = 0;
  let truncated = false;
  for await (const chunk of res.body) {
    const b = Buffer.from(chunk);
    total += b.length;
    if (total > maxBytes) {
      chunks.push(b.subarray(0, Math.max(0, maxBytes - (total - b.length))));
      truncated = true;
      break;
    }
    chunks.push(b);
  }
  return { buf: Buffer.concat(chunks), truncated };
}

// --- robots.txt -------------------------------------------------------------

const robotsCache = new Map();

export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'sitemap') { if (value) sitemaps.push(value); continue; }
    if (key === 'user-agent') {
      if (!current || current.rules.length || current.crawlDelay !== null) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (!current) {
      continue;
    } else if (key === 'disallow' || key === 'allow') {
      current.rules.push({ allow: key === 'allow', pattern: value });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n)) current.crawlDelay = n;
    }
  }
  return { groups, sitemaps };
}

function pathMatches(pattern, pathname) {
  if (pattern === '') return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp(`^${body.split('*').map(escapeRe).join('.*')}${anchored ? '$' : ''}`);
  return re.test(pathname);
}

function robotsVerdict(groups, url) {
  const u = new URL(url);
  const target = u.pathname + (u.search || '');
  const pick = (names) => groups.filter((g) => g.agents.some((a) => names.includes(a)));
  let selected = pick([ROBOTS_UA_TOKEN]);
  if (!selected.length) selected = pick(['*']);
  if (!selected.length) return { allowed: true, crawlDelay: null };
  let best = null;
  let crawlDelay = null;
  for (const g of selected) {
    if (g.crawlDelay !== null) crawlDelay = crawlDelay === null ? g.crawlDelay : Math.max(crawlDelay, g.crawlDelay);
    for (const rule of g.rules) {
      if (rule.allow === false && rule.pattern === '') continue; // bare "Disallow:" allows all
      if (!pathMatches(rule.pattern, target)) continue;
      const len = rule.pattern.length;
      if (!best || len > best.len || (len === best.len && rule.allow)) best = { allow: rule.allow, len };
    }
  }
  return { allowed: best ? best.allow : true, crawlDelay };
}

/** Fetches and caches robots.txt per origin. Returns groups + Sitemap: entries. */
export async function getRobots(origin, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const promise = (async () => {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const res = await withHostGate(hostOf(robotsUrl), () => rawFetch(robotsUrl, o.timeoutMs), o.sameHostDelayMs);
      if (res.status === 200) {
        const { buf } = await readCapped(res, o.maxBytes).catch(() => ({ buf: Buffer.alloc(0) }));
        if (!buf.length) return { status: 'unavailable', note: 'robots_body_read_failed', groups: null, sitemaps: [] };
        return { status: 'available', ...parseRobots(buf.toString('utf8')) };
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (loc) {
          const next = new URL(loc, robotsUrl).toString();
          const res2 = await withHostGate(hostOf(next), () => rawFetch(next, o.timeoutMs), o.sameHostDelayMs);
          if (res2.status === 200) {
            const { buf } = await readCapped(res2, o.maxBytes).catch(() => ({ buf: Buffer.alloc(0) }));
            if (buf.length) return { status: 'available', ...parseRobots(buf.toString('utf8')) };
          }
        }
        return { status: 'unavailable', note: `robots_redirect:${res.status}`, groups: null, sitemaps: [] };
      }
      // 404 etc: no rules exist, which is not an explicit refusal.
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return { status: 'unavailable', note: `robots_http:${res.status}`, groups: null, sitemaps: [] };
    } catch (e) {
      return { status: 'unavailable', note: `robots_error:${e?.name ?? 'Error'}`, groups: null, sitemaps: [] };
    }
  })();
  robotsCache.set(origin, promise);
  return promise;
}

export async function checkRobots(url, opts = {}) {
  let u;
  try { u = new URL(url); } catch { return { allowed: false, robotsStatus: 'invalid_url', crawlDelay: null }; }
  const robots = await getRobots(`${u.protocol}//${u.host}`, opts);
  if (robots.status !== 'available') {
    return { allowed: true, robotsStatus: 'unavailable', robotsNote: robots.note ?? null, crawlDelay: null };
  }
  const verdict = robotsVerdict(robots.groups, url);
  return {
    allowed: verdict.allowed,
    robotsStatus: verdict.allowed ? 'allowed' : 'blocked',
    robotsNote: null,
    crawlDelay: verdict.crawlDelay,
  };
}

const RETRYABLE = new Set(['TimeoutError', 'AbortError', 'TypeError', 'FetchError', 'SystemError']);

/**
 * Fetch one document politely. robots.txt is checked for every hop, so a
 * redirect can never be used to reach a disallowed URL.
 * Never persists `html` anywhere by itself — callers extract and drop it.
 */
export async function fetchDocument(startUrl, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const out = {
    requestUrl: startUrl,
    finalUrl: null,
    httpStatus: null,
    robotsStatus: null,
    robotsNote: null,
    contentType: null,
    bytesRead: null,
    truncated: null,
    redirectHops: 0,
    redirectChain: null,
    fetchedAt: null,
    ok: false,
    error: null,
    html: null,
  };
  let url = startUrl;
  const chain = [];
  let attempts = 0;

  for (let hop = 0; hop <= o.maxRedirects; hop += 1) {
    const host = hostOf(url);
    if (!host) { out.error = 'invalid_url'; return out; }
    // A host that returned 429 is left alone for the rest of the run.
    if (blockedHosts.has(host)) {
      out.error = 'host_stopped_after_429';
      out.finalUrl = url;
      requestStats.byError[out.error] = (requestStats.byError[out.error] ?? 0) + 1;
      return out;
    }

    let robots;
    try {
      robots = await checkRobots(url, o);
    } catch (e) {
      robots = { allowed: true, robotsStatus: 'unavailable', robotsNote: `robots_error:${e?.name ?? 'Error'}`, crawlDelay: null };
    }
    if (hop === 0) { out.robotsStatus = robots.robotsStatus; out.robotsNote = robots.robotsNote ?? null; }
    if (!robots.allowed) {
      out.robotsStatus = 'blocked';
      out.finalUrl = url;
      out.error = hop === 0 ? 'blocked_by_robots' : 'blocked_by_robots_after_redirect';
      out.redirectHops = hop;
      out.redirectChain = chain.length ? chain : null;
      return out;
    }
    if (robots.crawlDelay && robots.crawlDelay > o.sameHostDelayMs / 1000) {
      await sleep(Math.min(robots.crawlDelay, o.maxCrawlDelaySeconds) * 1000);
    }

    let res;
    try {
      res = await withHostGate(host, () => rawFetch(url, o.timeoutMs), o.sameHostDelayMs);
    } catch (e) {
      const name = e?.name ?? 'Error';
      const code = e?.cause?.code ? `:${e.cause.code}` : '';
      attempts += 1;
      if (attempts < o.maxAttempts && RETRYABLE.has(name)) { hop -= 1; await sleep(2_000); continue; }
      out.error = `${name}${code}`;
      requestStats.byError[out.error] = (requestStats.byError[out.error] ?? 0) + 1;
      out.finalUrl = url;
      out.redirectHops = chain.length;
      out.redirectChain = chain.length ? chain : null;
      return out;
    }

    out.httpStatus = res.status;
    out.finalUrl = url;
    requestStats.byStatus[res.status] = (requestStats.byStatus[res.status] ?? 0) + 1;
    if (res.status === 429) {
      blockedHosts.add(host);
      requestStats.blockedHosts = [...blockedHosts];
      out.error = 'http_429_host_stopped';
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return out;
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      try { await res.body?.cancel(); } catch { /* ignore */ }
      if (!loc) { out.error = `redirect_without_location:${res.status}`; break; }
      let next;
      try { next = new URL(loc, url).toString(); } catch { out.error = 'invalid_redirect_target'; break; }
      chain.push({ from: url, status: res.status, to: next });
      if (chain.length > o.maxRedirects) { out.error = 'too_many_redirects'; break; }
      url = next;
      continue;
    }

    out.redirectHops = chain.length;
    out.redirectChain = chain.length ? chain : null;
    out.fetchedAt = new Date().toISOString();

    if (res.status !== 200) {
      out.error = `http_${res.status}`;
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return out;
    }

    const ctype = res.headers.get('content-type');
    out.contentType = ctype ?? null;
    if (ctype && !/html|xml|text\/plain/i.test(ctype)) {
      out.error = 'non_html_content';
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return out;
    }

    // A connection can drop mid-body; undici throws here, not at fetch().
    let buf;
    let truncated;
    try {
      ({ buf, truncated } = await readCapped(res, o.maxBytes));
    } catch (e) {
      out.error = `body_read_failed:${e?.name ?? 'Error'}${e?.cause?.code ? `:${e.cause.code}` : ''}`;
      requestStats.byError[out.error] = (requestStats.byError[out.error] ?? 0) + 1;
      return out;
    }
    out.bytesRead = buf.length;
    out.truncated = truncated;
    out.html = decodeBody(buf, ctype);
    out.ok = true;
    return out;
  }

  out.redirectHops = chain.length;
  out.redirectChain = chain.length ? chain : null;
  if (!out.error) out.error = 'unresolved';
  return out;
}

// ---------------------------------------------------------------------------
// sitemaps
// ---------------------------------------------------------------------------

export function parseSitemap(xml) {
  const locs = [];
  const re = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const u = decodeEntities(m[1]).trim();
    if (/^https?:\/\//i.test(u)) locs.push(u);
  }
  return { isIndex: /<sitemapindex/i.test(xml), locs };
}

// ---------------------------------------------------------------------------
// small async pool
// ---------------------------------------------------------------------------

/**
 * One failing item must never abort a multi-thousand-item run, so the worker's
 * exception is handed back through `onItemError` instead of rejecting.
 */
export async function runPool(items, size, worker, onItemError = null) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (e) {
        if (!onItemError) throw e;
        results[i] = await onItemError(items[i], e, i);
      }
    }
  }));
  return results;
}

export function median(nums) {
  const s = nums.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const round = (v, p = 4) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(p)) : null);
export const rate = (n, d) => (d ? n / d : null);
