#!/usr/bin/env node
/**
 * NARU Research stage 2 (v2): structure the official recruitment pages that are
 * explicitly published in the Shokuba Rabo information/communications seed.
 *
 * Supersedes scripts/research-recruitment-pages.py (kept for provenance of the
 * first pilot run). This version adds the handoff-required schema
 * (fetchedAt / pageTitle / httpStatus / JobPosting detail), redirect tracking,
 * third-party job-platform classification, page-type classification and
 * stale new-grad detection — and it runs on the repo's existing Node toolchain.
 *
 * Scope is deliberately narrow and conservative:
 * - only explicit official recruitment URLs already published in Shokuba Rabo
 * - no login, no CAPTCHA/anti-bot bypass, no JavaScript browser automation
 * - robots.txt honoured whenever it explicitly disallows the URL
 * - one in-flight request per host, a delay between same-host requests,
 *   small global concurrency, response-size cap
 * - 403/429/404 are recorded as "not retrievable" and never retried around
 * - third-party job platforms are recorded as a fact only; they are never
 *   crawled beyond the single URL that Shokuba Rabo itself published
 * - no page body is stored; only flags and explicitly readable structured values
 * - unknown values are null, never 0 and never false
 *
 * Usage:
 *   node scripts/research-recruitment-pages.mjs [--limit N] [--concurrency N]
 *                                               [--only <substring>] [--list]
 */
import fs from 'node:fs';
import path from 'node:path';

const RUN_DATE = '2026-10-04';
const IN_PATH = path.join('data', 'research', 'shokuba', `${RUN_DATE}-information-communications-seed.csv`);
const OUT_DIR = path.join('data', 'research', 'shokuba');
/** `--out-tag smoke` writes *-pilot-smoke.* so a partial run never clobbers the dataset. */
const outPaths = (tag) => ({
  json: path.join(OUT_DIR, `${RUN_DATE}-recruitment-pages-pilot${tag ? `-${tag}` : ''}.json`),
  csv: path.join(OUT_DIR, `${RUN_DATE}-recruitment-pages-pilot${tag ? `-${tag}` : ''}.csv`),
});

const USER_AGENT = 'NARUResearch/1.0 (+https://naru-career.com/; public recruitment-page research)';
const ROBOTS_UA_TOKEN = 'naruresearch';
const REQUEST_TIMEOUT_MS = 20_000;
const SAME_HOST_DELAY_MS = 1_500;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;
const DEFAULT_CONCURRENCY = 5;
/** Only network/timeout style failures are retried, and only once. */
const MAX_ATTEMPTS = 2;

const HEADERS = {
  corporateNumber: '法人番号',
  company: '企業名',
  prefecture: '都道府県',
  companySize: '企業規模',
  homepage: '企業ホームページ',
  recruitmentPage: '採用ページ',
};

/**
 * Keyword flags. `ascii: true` means the pattern is matched with word
 * boundaries and case-sensitively, so that short Latin tokens such as "SE" do
 * not match inside unrelated English words ("services", "please", "case").
 */
const KEYWORDS = {
  secondNewGrad: [{ p: '第二新卒' }],
  inexperienced: [{ p: '未経験' }, { p: '経験不問' }],
  recentGraduate: [{ p: '既卒' }],
  // Bare「ポテンシャル」is excluded on purpose: it is common marketing copy
  // ("ポテンシャルを発揮") and does not evidence a potential-hire track.
  potentialHire: [{ p: 'ポテンシャル採用' }, { p: 'ポテンシャル人材' }, { p: 'ポテンシャル枠' }, { p: 'ポテンシャル層' }],
  training: [{ p: '研修' }],
  mentor: [{ p: 'メンター' }, { p: 'メンタリング' }],
  remote: [{ p: 'リモート' }, { p: '在宅勤務' }, { p: 'テレワーク' }],
  fullRemote: [{ p: 'フルリモート' }, { p: '完全在宅' }, { p: 'フルリモ' }],
  engineer: [
    { p: 'エンジニア' }, { p: 'プログラマ' }, { p: 'システムエンジニア' },
    { p: 'SE', ascii: true }, { p: 'PG', ascii: true },
  ],
  webMarketing: [{ p: 'webマーケ', ci: true }, { p: 'デジタルマーケ', ci: true }, { p: 'ネットマーケ', ci: true }],
  webDirector: [{ p: 'webディレク', ci: true }, { p: 'ディレクター職', ci: true }],
  portfolio: [{ p: 'ポートフォリオ' }, { p: 'portfolio', ascii: true, ci: true }],
  practicalExperience: [{ p: '実務経験' }],
  salaryMention: [{ p: '年収' }, { p: '月給' }, { p: '給与' }, { p: '初任給' }, { p: '月額基本給' }],
  newGrad: [{ p: '新卒' }],
  midCareer: [{ p: '中途採用' }, { p: 'キャリア採用' }, { p: '経験者採用' }],
};

/**
 * Third-party job platforms / aggregators. A recruitment URL that points here
 * is recorded as a fact (the company published it) but is never used as
 * evidence about the company's own site, and is never crawled beyond this URL.
 */
const JOB_PLATFORM_DOMAINS = [
  'indeed.com', 'jp.indeed.com', 'wantedly.com', 'doda.jp', 'mynavi.jp', 'rikunabi.com',
  'type.jp', 'green-japan.com', 'bizreach.jp', 'openwork.jp', 'jobtalk.jp', 'en-japan.com',
  'enjapan.com', 'employment.en-japan.com', 'tenshoku.mynavi.jp', 'next.rikunabi.com',
  'xn--pckua2a7gp15o89zb.com', 'kyujinbox.com', 'baitoru.com', 'townwork.net',
  'levtech.jp', 'paiza.jp', 'forkwell.com', 'findy-code.io', 'geekly.co.jp',
  'hatalike.jp', 'job-medley.com', 'shigoto.mhlw.go.jp', 'hellowork.mhlw.go.jp',
  'careercross.com', 'daijob.com', 'linkedin.com', 'glassdoor.com',
  'lancers.jp', 'crowdworks.jp', 'career-tasu.jp', 'onecareer.jp', 'jobrass.com',
  'syukatsu-kaigi.jp', 'gaishishukatsu.com', 'shukatsu-note.com', 'job.mynavi.jp',
];

/**
 * Recruiting SaaS / ATS hosts. These are the company's own posting, just hosted
 * elsewhere, so they are counted as a company-controlled recruitment page.
 */
const ATS_DOMAINS = [
  'herp.careers', 'hrmos.co', 'talentio.com', 'recruitee.com', 'en-gage.net',
  'engage.en-japan.com', 'jobs.gluegent.net', 'workable.com', 'greenhouse.io',
  'lever.co', 'smarthr.jp', 'jobcan-ats.jp', 'recme.jp', 'jinjer.jp',
  'airwork.net', 'job.hrmos.co', 'recruitment-cloud.jp', 'careerplus.jp',
];

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function parseCsv(str) {
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

function readSeed(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(text);
  const headers = rows[0];
  return rows.slice(1)
    .filter((r) => r.length === headers.length)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

/** Crude registrable-domain guess; good enough for same-company comparison. */
function registrableDomain(host) {
  if (!host) return null;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const twoLevelSuffixes = new Set(['co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp', 'gr.jp', 'lg.jp', 'com.cn', 'co.uk']);
  const last2 = parts.slice(-2).join('.');
  if (twoLevelSuffixes.has(last2)) return parts.slice(-3).join('.');
  return last2;
}

function domainMatches(host, list) {
  if (!host) return false;
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildMatcher(spec) {
  const flags = spec.ci ? 'i' : '';
  const body = escapeRe(spec.p);
  return spec.ascii ? new RegExp(`\\b${body}\\b`, flags) : new RegExp(body, flags);
}

const KEYWORD_MATCHERS = Object.fromEntries(
  Object.entries(KEYWORDS).map(([name, specs]) => [name, specs.map(buildMatcher)]),
);

// ---------------------------------------------------------------------------
// HTML handling (no page body is ever persisted)
// ---------------------------------------------------------------------------

function decodeBody(buf, contentType) {
  const candidates = [];
  const fromHeader = contentType && /charset=([^;\s]+)/i.exec(contentType);
  if (fromHeader) candidates.push(fromHeader[1].replace(/['"]/g, ''));
  const head = Buffer.from(buf.subarray(0, 4096)).toString('latin1');
  const fromMeta = /<meta[^>]+charset=["']?([^"'\s/>]+)/i.exec(head);
  if (fromMeta) candidates.push(fromMeta[1]);
  candidates.push('utf-8', 'shift_jis', 'euc-jp');
  for (const enc of candidates) {
    try {
      const decoded = new TextDecoder(enc.trim().toLowerCase(), { fatal: true }).decode(buf);
      return decoded;
    } catch { /* try next */ }
  }
  return new TextDecoder('utf-8').decode(buf);
}

function extractJsonLdBlocks(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function stripToVisibleText(html) {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  return s.replace(/\s+/g, ' ').trim();
}

function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  if (!m) return null;
  const t = stripToVisibleText(m[1]);
  return t ? t.slice(0, 500) : null;
}

function extractLinkHosts(html, baseUrl) {
  const hosts = new Set();
  const re = /<a\b[^>]*href\s*=\s*["']([^"'>\s]+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let abs;
    try { abs = new URL(m[1], baseUrl); } catch { continue; }
    if (!/^https?:$/.test(abs.protocol)) continue;
    const h = abs.hostname.toLowerCase().replace(/^www\./, '');
    if (domainMatches(h, JOB_PLATFORM_DOMAINS)) hosts.add(h);
  }
  return [...hosts].sort();
}

function* walkJson(node) {
  if (Array.isArray(node)) {
    for (const v of node) yield* walkJson(v);
  } else if (node && typeof node === 'object') {
    yield node;
    for (const v of Object.values(node)) yield* walkJson(v);
  }
}

function asText(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') { const t = v.replace(/\s+/g, ' ').trim(); return t || null; }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    const parts = v.map(asText).filter(Boolean);
    return parts.length ? parts.join(' | ').slice(0, 600) : null;
  }
  if (typeof v === 'object') {
    for (const k of ['name', 'value', 'title', 'description', 'text']) {
      if (v[k] !== undefined) { const t = asText(v[k]); if (t) return t; }
    }
    return null;
  }
  return null;
}

function numberOrNull(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = /-?\d[\d,]*(?:\.\d+)?/.exec(v);
    if (m) { const n = Number(m[0].replace(/,/g, '')); return Number.isFinite(n) ? n : null; }
  }
  return null;
}

function parseSalary(baseSalary) {
  const result = { salaryMin: null, salaryMax: null, salaryCurrency: null, salaryUnit: null };
  if (!baseSalary || typeof baseSalary !== 'object') return result;
  const nodes = Array.isArray(baseSalary) ? baseSalary : [baseSalary];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    result.salaryCurrency = result.salaryCurrency ?? asText(node.currency) ?? null;
    const v = node.value;
    if (v && typeof v === 'object') {
      result.salaryMin = result.salaryMin ?? numberOrNull(v.minValue) ?? numberOrNull(v.value);
      result.salaryMax = result.salaryMax ?? numberOrNull(v.maxValue) ?? numberOrNull(v.value);
      result.salaryUnit = result.salaryUnit ?? asText(v.unitText);
    } else {
      result.salaryMin = result.salaryMin ?? numberOrNull(v);
      result.salaryMax = result.salaryMax ?? numberOrNull(v);
    }
  }
  return result;
}

function jobLocationText(jobLocation) {
  const nodes = Array.isArray(jobLocation) ? jobLocation : [jobLocation];
  const parts = [];
  for (const n of nodes) {
    if (!n || typeof n !== 'object') { const t = asText(n); if (t) parts.push(t); continue; }
    const addr = n.address ?? n;
    if (addr && typeof addr === 'object') {
      const t = [addr.addressRegion, addr.addressLocality, addr.streetAddress]
        .map(asText).filter(Boolean).join(' ');
      if (t) { parts.push(t); continue; }
    }
    const t = asText(n);
    if (t) parts.push(t);
  }
  return parts.length ? [...new Set(parts)].join(' | ').slice(0, 300) : null;
}

/** Returns { hasJobPosting, parseFailed, postings[] }. All unknowns stay null. */
function extractJobPostings(blocks) {
  if (!blocks.length) return { hasJobPosting: false, parseFailed: false, postings: [] };
  const postings = [];
  let parsedAny = false;
  let parseFailed = false;
  for (const raw of blocks) {
    let data;
    try { data = JSON.parse(raw); parsedAny = true; } catch { parseFailed = true; continue; }
    for (const node of walkJson(data)) {
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      if (!types.some((t) => typeof t === 'string' && t.toLowerCase() === 'jobposting')) continue;
      postings.push({
        title: asText(node.title),
        occupationalCategory: asText(node.occupationalCategory),
        employmentType: asText(node.employmentType),
        datePosted: asText(node.datePosted),
        validThrough: asText(node.validThrough),
        ...parseSalary(node.baseSalary),
        jobLocation: jobLocationText(node.jobLocation),
        experienceRequirements: asText(node.experienceRequirements),
        skills: asText(node.skills),
        qualifications: asText(node.qualifications),
        hiringOrganization: asText(node.hiringOrganization),
      });
    }
  }
  const textHasType = !postings.length && blocks.some((b) => /"?JobPosting"?/i.test(b));
  return { hasJobPosting: postings.length > 0 || textHasType, parseFailed, parsedAny, postings };
}

// ---------------------------------------------------------------------------
// polite fetching
// ---------------------------------------------------------------------------

const hostGates = new Map();

/** Serialises requests per host and keeps a fixed gap between them. */
async function withHostGate(host, fn) {
  const prev = hostGates.get(host) ?? Promise.resolve();
  let release;
  const current = new Promise((r) => { release = r; });
  hostGates.set(host, prev.then(() => current));
  await prev;
  try {
    return await fn();
  } finally {
    setTimeout(release, SAME_HOST_DELAY_MS);
  }
}

async function rawFetch(url, { method = 'GET' } = {}) {
  return fetch(url, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      'Accept-Language': 'ja,en;q=0.5',
    },
  });
}

async function readCapped(res) {
  if (!res.body) return { buf: Buffer.alloc(0), truncated: false };
  const chunks = [];
  let total = 0;
  let truncated = false;
  for await (const chunk of res.body) {
    const b = Buffer.from(chunk);
    total += b.length;
    if (total > MAX_BYTES) {
      chunks.push(b.subarray(0, Math.max(0, MAX_BYTES - (total - b.length))));
      truncated = true;
      break;
    }
    chunks.push(b);
  }
  return { buf: Buffer.concat(chunks), truncated };
}

// --- robots.txt -------------------------------------------------------------

const robotsCache = new Map();

function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
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
  return groups;
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
      if (rule.allow === false && rule.pattern === '') continue; // "Disallow:" means allow all
      if (!pathMatches(rule.pattern, target)) continue;
      const len = rule.pattern.length;
      if (!best || len > best.len || (len === best.len && rule.allow)) best = { allow: rule.allow, len };
    }
  }
  return { allowed: best ? best.allow : true, crawlDelay };
}

async function getRobots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const promise = (async () => {
    const robotsUrl = `${origin}/robots.txt`;
    const host = hostOf(robotsUrl);
    try {
      const res = await withHostGate(host, () => rawFetch(robotsUrl));
      if (res.status >= 300 && res.status < 400) {
        // One hop only; anything more is treated as unavailable.
        const loc = res.headers.get('location');
        if (loc) {
          const next = new URL(loc, robotsUrl).toString();
          const res2 = await withHostGate(hostOf(next), () => rawFetch(next));
          if (res2.ok) {
            const { buf } = await readCapped(res2);
            return { status: 'available', groups: parseRobots(buf.toString('utf8')) };
          }
        }
        return { status: 'unavailable', note: `robots_redirect:${res.status}`, groups: null };
      }
      if (res.status === 200) {
        const { buf } = await readCapped(res);
        return { status: 'available', groups: parseRobots(buf.toString('utf8')) };
      }
      // 404 and friends: no robots rules exist. Treated as "no explicit refusal",
      // which is what the handoff requires.
      return { status: 'unavailable', note: `robots_http:${res.status}`, groups: null };
    } catch (e) {
      return { status: 'unavailable', note: `robots_error:${e?.name ?? 'Error'}`, groups: null };
    }
  })();
  robotsCache.set(origin, promise);
  return promise;
}

async function checkRobots(url) {
  const u = new URL(url);
  const robots = await getRobots(`${u.protocol}//${u.host}`);
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

// ---------------------------------------------------------------------------
// one target
// ---------------------------------------------------------------------------

const RETRYABLE = new Set(['TimeoutError', 'AbortError', 'TypeError', 'FetchError', 'SystemError']);

function emptyFlags() {
  return Object.fromEntries(Object.keys(KEYWORDS).map((k) => [k, null]));
}

function classifyHost(recruitHost, homepageHost) {
  if (!recruitHost) return 'unknown';
  // ATS first: some ATS hosts sit under a job-platform parent domain.
  if (domainMatches(recruitHost, ATS_DOMAINS)) return 'atsHosted';
  if (domainMatches(recruitHost, JOB_PLATFORM_DOMAINS)) return 'jobPlatform';
  if (homepageHost && registrableDomain(recruitHost) === registrableDomain(homepageHost)) return 'ownDomain';
  return 'otherDomain';
}

function guessPageType(url, title) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const p = decodeURIComponent(u.pathname).toLowerCase();
  const hash = decodeURIComponent(u.hash || '').toLowerCase();
  const t = (title ?? '').toLowerCase();
  const recruitWord = /(recruit|saiyo|saiyou|career|careers|job|jobs|entry|employ|採用|求人|募集)/;
  const isTop = p === '/' || /^\/(index|home)(\.[a-z]+)?$/.test(p);
  // A "#recruit" anchor on the top page is a section link, not a dedicated page.
  if (isTop && recruitWord.test(hash)) return 'topPageAnchor';
  if (recruitWord.test(p) || /(採用|求人|recruit|career)/.test(t)) return 'recruitment';
  if (isTop) return 'homeTop';
  return 'otherPage';
}

function graduationYears(text) {
  const years = new Set();
  const re = /(20\d{2})\s*年(?:度)?\s*(?:卒|新卒|入社)/g;
  let m;
  while ((m = re.exec(text)) !== null) years.add(Number(m[1]));
  return [...years].sort();
}

async function processTarget(target) {
  const base = {
    corporateNumber: target.corporateNumber || null,
    company: target.company || null,
    prefecture: target.prefecture || null,
    companySize: target.companySize || null,
    homepageUrl: target.homepageUrl || null,
    sourceUrl: target.recruitmentUrl,
    sourceUrlCount: target.sourceUrlCount,
    finalUrl: null,
    httpStatus: null,
    pageTitle: null,
    fetchedAt: null,
    fetchOk: false,
    fetchError: null,
    robotsStatus: null,
    robotsNote: null,
    redirected: null,
    redirectHops: null,
    redirectChain: null,
    contentType: null,
    bytesRead: null,
    truncated: null,
    visibleChars: null,
    flags: emptyFlags(),
    flagTerms: null,
    jobPostingJsonLd: null,
    jobPostingTitles: null,
    jobPostings: null,
    jsonLdBlocks: null,
    jsonLdParseFailed: null,
    jobPlatformLinkHosts: null,
    classification: {
      hostCategory: classifyHost(hostOf(target.recruitmentUrl), hostOf(target.homepageUrl)),
      finalHostCategory: null,
      sameRegistrableDomainAsHomepage: null,
      pageTypeGuess: null,
      newGradOnly: null,
      graduationYearsMentioned: null,
      staleNewGradYear: null,
      jsDependentSuspected: null,
    },
  };

  let url = target.recruitmentUrl;
  const chain = [];
  let attempt = 0;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const host = hostOf(url);
    if (!host) { base.fetchError = 'invalid_url'; return base; }

    let robots;
    try {
      robots = await checkRobots(url);
    } catch (e) {
      robots = { allowed: true, robotsStatus: 'unavailable', robotsNote: `robots_error:${e?.name ?? 'Error'}`, crawlDelay: null };
    }
    if (hop === 0) { base.robotsStatus = robots.robotsStatus; base.robotsNote = robots.robotsNote; }
    if (!robots.allowed) {
      base.robotsStatus = 'blocked';
      base.finalUrl = url;
      base.fetchError = hop === 0 ? 'blocked_by_robots' : 'blocked_by_robots_after_redirect';
      base.redirected = hop > 0;
      base.redirectHops = hop;
      base.redirectChain = chain.length ? chain : null;
      return base;
    }
    if (robots.crawlDelay && robots.crawlDelay > SAME_HOST_DELAY_MS / 1000) {
      await sleep(Math.min(robots.crawlDelay, 10) * 1000);
    }

    let res;
    try {
      res = await withHostGate(host, () => rawFetch(url));
    } catch (e) {
      const name = e?.name ?? 'Error';
      const cause = e?.cause?.code ? `:${e.cause.code}` : '';
      if (attempt + 1 < MAX_ATTEMPTS && RETRYABLE.has(name)) {
        attempt += 1;
        hop -= 1; // retry the same hop
        await sleep(2_000);
        continue;
      }
      base.fetchError = `${name}${cause}`;
      base.finalUrl = url;
      base.redirected = hop > 0;
      base.redirectHops = hop;
      base.redirectChain = chain.length ? chain : null;
      return base;
    }

    base.httpStatus = res.status;
    base.finalUrl = url;

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) { base.fetchError = `redirect_without_location:${res.status}`; break; }
      let next;
      try { next = new URL(loc, url).toString(); } catch { base.fetchError = 'invalid_redirect_target'; break; }
      chain.push({ from: url, status: res.status, to: next });
      if (chain.length > MAX_REDIRECTS) { base.fetchError = 'too_many_redirects'; break; }
      url = next;
      continue;
    }

    base.redirected = chain.length > 0;
    base.redirectHops = chain.length;
    base.redirectChain = chain.length ? chain : null;
    base.fetchedAt = new Date().toISOString();

    if (res.status !== 200) {
      base.fetchError = `http_${res.status}`;
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return base;
    }

    const ctype = res.headers.get('content-type');
    base.contentType = ctype ?? null;
    if (ctype && !/html|xml/i.test(ctype)) {
      base.fetchError = 'non_html_content';
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return base;
    }

    const { buf, truncated } = await readCapped(res);
    base.bytesRead = buf.length;
    base.truncated = truncated;
    const html = decodeBody(buf, ctype);
    const visible = stripToVisibleText(html);
    const title = extractTitle(html);
    const blocks = extractJsonLdBlocks(html);
    const jp = extractJobPostings(blocks);

    base.pageTitle = title;
    base.visibleChars = visible.length;
    base.fetchOk = true;
    base.jsonLdBlocks = blocks.length;
    base.jsonLdParseFailed = jp.parseFailed;
    base.jobPostingJsonLd = jp.hasJobPosting;
    base.jobPostings = jp.postings.length ? jp.postings : [];
    base.jobPostingTitles = [...new Set(jp.postings.map((p) => p.title).filter(Boolean))].slice(0, 20);
    base.jobPlatformLinkHosts = extractLinkHosts(html, url);

    // Keep the matched terms so every true flag can be audited without re-fetching.
    const haystack = `${visible} ${title ?? ''}`;
    const flags = {};
    const flagTerms = {};
    for (const [name, specs] of Object.entries(KEYWORDS)) {
      const hits = specs.filter((_, i) => KEYWORD_MATCHERS[name][i].test(haystack)).map((s) => s.p);
      flags[name] = hits.length > 0;
      if (hits.length) flagTerms[name] = hits;
    }
    base.flags = flags;
    base.flagTerms = flagTerms;

    const finalHost = hostOf(url);
    const years = graduationYears(haystack);
    base.classification = {
      hostCategory: base.classification.hostCategory,
      finalHostCategory: classifyHost(finalHost, hostOf(target.homepageUrl)),
      sameRegistrableDomainAsHomepage: target.homepageUrl
        ? registrableDomain(finalHost) === registrableDomain(hostOf(target.homepageUrl))
        : null,
      pageTypeGuess: guessPageType(url, title),
      newGradOnly: base.flags.newGrad && !base.flags.midCareer && !base.flags.secondNewGrad,
      graduationYearsMentioned: years.length ? years : null,
      staleNewGradYear: years.length ? Math.max(...years) < 2026 : null,
      jsDependentSuspected: visible.length < 400,
    };
    return base;
  }

  base.redirected = chain.length > 0;
  base.redirectHops = chain.length;
  base.redirectChain = chain.length ? chain : null;
  if (!base.fetchError) base.fetchError = 'unresolved';
  return base;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { limit: null, concurrency: DEFAULT_CONCURRENCY, only: null, list: false, outTag: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (a === '--only') out.only = argv[++i];
    else if (a === '--out-tag') out.outTag = argv[++i];
    else if (a === '--list') out.list = true;
  }
  return out;
}

async function runPool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(IN_PATH)) throw new Error(`Missing seed: ${IN_PATH}`);
  const rows = readSeed(IN_PATH);

  const listed = [];
  for (const r of rows) {
    const url = (r[HEADERS.recruitmentPage] || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    listed.push({
      corporateNumber: (r[HEADERS.corporateNumber] || '').trim(),
      company: (r[HEADERS.company] || '').trim(),
      prefecture: (r[HEADERS.prefecture] || '').trim(),
      companySize: (r[HEADERS.companySize] || '').trim(),
      homepageUrl: (r[HEADERS.homepage] || '').trim(),
      recruitmentUrl: url,
    });
  }

  // One request per distinct URL; duplicates are recorded, not re-fetched.
  const byUrl = new Map();
  for (const t of listed) {
    if (!byUrl.has(t.recruitmentUrl)) byUrl.set(t.recruitmentUrl, { ...t, sourceUrlCount: 0, companies: [] });
    const entry = byUrl.get(t.recruitmentUrl);
    entry.sourceUrlCount += 1;
    entry.companies.push({ corporateNumber: t.corporateNumber, company: t.company });
  }
  let targets = [...byUrl.values()];
  if (args.only) targets = targets.filter((t) => t.recruitmentUrl.includes(args.only) || t.company.includes(args.only));
  if (args.limit) targets = targets.slice(0, args.limit);

  if (args.list) {
    console.log(JSON.stringify({ listedUrlRows: listed.length, distinctUrls: byUrl.size, selected: targets.length }, null, 2));
    return;
  }

  const startedAt = new Date();
  const results = await runPool(targets, args.concurrency, async (t) => {
    const r = await processTarget(t);
    r.duplicateCompanies = t.companies.length > 1 ? t.companies : null;
    process.stderr.write(`${r.fetchOk ? 'ok  ' : 'miss'} ${String(r.httpStatus ?? r.fetchError).padEnd(22)} ${t.recruitmentUrl}\n`);
    return r;
  });

  results.sort((a, b) => (a.company ?? '').localeCompare(b.company ?? '', 'ja') || (a.sourceUrl ?? '').localeCompare(b.sourceUrl ?? ''));

  const ok = results.filter((r) => r.fetchOk);
  const statusCounts = {};
  const errorCounts = {};
  for (const r of results) {
    const k = r.httpStatus === null ? 'none' : String(r.httpStatus);
    statusCounts[k] = (statusCounts[k] ?? 0) + 1;
    if (r.fetchError) errorCounts[r.fetchError] = (errorCounts[r.fetchError] ?? 0) + 1;
  }
  const flagCounts = Object.fromEntries(
    Object.keys(KEYWORDS).map((k) => [k, ok.filter((r) => r.flags[k] === true).length]),
  );

  const payload = {
    runDate: RUN_DATE,
    generatedAtUtc: startedAt.toISOString(),
    finishedAtUtc: new Date().toISOString(),
    scope: 'Explicit recruitment-page URLs published in the Shokuba Rabo information/communications seed only',
    crawler: 'scripts/research-recruitment-pages.mjs',
    listedUrlRows: listed.length,
    targetCount: targets.length,
    successCount: ok.length,
    successRate: targets.length ? ok.length / targets.length : null,
    jobPostingJsonLdCount: ok.filter((r) => r.jobPostingJsonLd === true).length,
    keywordCountsAmongSuccessfulPages: flagCounts,
    statusCounts,
    errorCounts,
    settings: {
      userAgent: USER_AGENT,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxAttempts: MAX_ATTEMPTS,
      sameHostDelayMs: SAME_HOST_DELAY_MS,
      concurrency: args.concurrency,
      maxBytes: MAX_BYTES,
      maxRedirects: MAX_REDIRECTS,
    },
    methodNotes: [
      'Only public official recruitment URLs explicitly listed in Shokuba Rabo were requested.',
      'robots.txt is honoured whenever it explicitly disallows the URL, including after a redirect.',
      'No login, CAPTCHA/anti-bot bypass, JavaScript browser automation, or page-body storage is used.',
      '403/429/404 are recorded as not retrievable; only timeouts and transport errors are retried, once.',
      'Third-party job platforms are recorded as a fact only and are never crawled beyond the single published URL.',
      'Keyword flags prove only that the term appears on the fetched page; they do not prove an open role with that condition.',
      'null means not retrieved / not disclosed. It never means zero and never means false.',
    ],
    results,
  };

  const out = outPaths(args.outTag);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(out.json, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const flagKeys = Object.keys(KEYWORDS);
  const columns = [
    'corporateNumber', 'company', 'prefecture', 'companySize', 'homepageUrl', 'sourceUrl', 'finalUrl',
    'httpStatus', 'pageTitle', 'fetchedAt', 'fetchOk', 'fetchError', 'robotsStatus', 'robotsNote',
    'redirected', 'redirectHops', 'contentType', 'bytesRead', 'visibleChars',
    'hostCategory', 'finalHostCategory', 'sameRegistrableDomainAsHomepage', 'pageTypeGuess',
    'newGradOnly', 'graduationYearsMentioned', 'staleNewGradYear', 'jsDependentSuspected',
    ...flagKeys,
    'jobPostingJsonLd', 'jobPostingCount', 'jobPostingTitles',
    'jobPostingEmploymentTypes', 'jobPostingSalaryMin', 'jobPostingSalaryMax',
    'jobPostingLocations', 'jobPostingExperienceRequirements', 'jobPostingSkills', 'jobPostingQualifications',
    'jobPlatformLinkHosts', 'duplicateUrlCompanyCount',
  ];
  const lines = [columns.join(',')];
  for (const r of results) {
    const p = r.jobPostings ?? [];
    const pick = (fn) => {
      const vals = p.map(fn).filter((v) => v !== null && v !== undefined && v !== '');
      return vals.length ? [...new Set(vals)].join(' | ') : null;
    };
    const mins = p.map((x) => x.salaryMin).filter((v) => typeof v === 'number');
    const maxs = p.map((x) => x.salaryMax).filter((v) => typeof v === 'number');
    const row = {
      ...r,
      ...r.classification,
      graduationYearsMentioned: r.classification.graduationYearsMentioned?.join(' ') ?? null,
      ...Object.fromEntries(flagKeys.map((k) => [k, r.flags[k]])),
      jobPostingCount: r.jobPostings === null ? null : p.length,
      jobPostingTitles: r.jobPostingTitles?.join(' | ') ?? null,
      jobPostingEmploymentTypes: pick((x) => x.employmentType),
      jobPostingSalaryMin: mins.length ? Math.min(...mins) : null,
      jobPostingSalaryMax: maxs.length ? Math.max(...maxs) : null,
      jobPostingLocations: pick((x) => x.jobLocation),
      jobPostingExperienceRequirements: pick((x) => x.experienceRequirements),
      jobPostingSkills: pick((x) => x.skills),
      jobPostingQualifications: pick((x) => x.qualifications),
      jobPlatformLinkHosts: r.jobPlatformLinkHosts?.join(' ') ?? null,
      duplicateUrlCompanyCount: r.sourceUrlCount ?? null,
    };
    lines.push(columns.map((c) => csvEscape(row[c])).join(','));
  }
  fs.writeFileSync(out.csv, `﻿${lines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify({
    listedUrlRows: listed.length,
    targetCount: targets.length,
    successCount: ok.length,
    jobPostingJsonLdCount: payload.jobPostingJsonLdCount,
    statusCounts,
    errorCounts,
    out: [out.json, out.csv],
  }, null, 2));
}

main().catch((e) => {
  console.error(`ERROR: ${e?.stack ?? e}`);
  process.exit(1);
});
