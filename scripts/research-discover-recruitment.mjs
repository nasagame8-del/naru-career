#!/usr/bin/env node
/**
 * NARU Research stage 4: discover each company's OFFICIAL recruitment page,
 * starting from the company homepage published in Shokuba Rabo.
 *
 * Allowed discovery routes only:
 *   1. anchors on the company homepage
 *   2. Sitemap: entries in the company's robots.txt
 *   3. URLs inside those sitemaps (one level of sitemapindex followed)
 *   4. recruitment pages inside the company's own site
 *   5. an official ATS linked directly from the company site
 *
 * Explicitly NOT done:
 *   - URL brute-forcing / guessing paths such as /recruit/ that nothing linked
 *   - CAPTCHA or anti-bot bypass, logins, JavaScript automation
 *   - ignoring an explicit robots.txt Disallow (checked on every redirect hop)
 *   - scraping search engines
 *   - crawling across third-party job media (Indeed, 求人ボックス, OpenWork,
 *     転職会議, マイナビ, リクナビ …). Such links are recorded as a fact and
 *     classified `jobPlatform`; they never become an adopted recruitment page.
 *
 * confidence:
 *   high   = linked from the company's own site with explicit recruitment
 *            wording, on the company's own domain or an official ATS
 *   medium = unambiguous recruitment URL found in the company's sitemap, or a
 *            company-domain recruitment URL whose anchor text was uninformative
 *   low    = weak/ambiguous signal. Recorded, but NOT auto-adopted downstream.
 *
 * Usage:
 *   node scripts/research-discover-recruitment.mjs --sample 300 [--seed N]
 *   node scripts/research-discover-recruitment.mjs --all          (3,512 companies)
 *   node scripts/research-discover-recruitment.mjs --sample 20 --out-tag smoke
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  readCsvObjects, writeCsv, fetchDocument, getRobots, parseSitemap, extractAnchors,
  extractTitle, extractHeadings, stripToVisibleText, extractJsonLdBlocks, extractJobPostings,
  classifyHost, hostOf, isAts, runPool, round, rate,
  DEFAULTS, USER_AGENT,
} from './research-web.mjs';

const RUN_DATE = '2026-10-04';
const DIR = path.join('data', 'research', 'shokuba');
const SEED_PATH = path.join(DIR, `${RUN_DATE}-information-communications-seed.csv`);

const H = {
  corporateNumber: '法人番号',
  company: '企業名',
  prefecture: '都道府県',
  companySize: '企業規模',
  homepage: '企業ホームページ',
  recruitmentPage: '採用ページ',
};

const MAX_SITEMAPS_PER_COMPANY = 2;
const MAX_SITEMAP_CHILDREN = 2;
const MAX_CANDIDATE_VERIFICATIONS = 2;

/** Anchor wording that states "this is the recruitment page". */
const ANCHOR_STRONG = [
  '採用情報', '採用サイト', '採用ページ', '採用について', '採用', '求人情報', '求人', '募集要項', '募集',
  '新卒採用', '中途採用', 'キャリア採用', '第二新卒', '経験者採用', 'エントリー',
  'recruit', 'recruiting', 'recruitment', 'career', 'careers', 'job', 'jobs', 'hiring', 'entry',
];
/** Anchor wording that is recruitment-adjacent but not conclusive on its own. */
const ANCHOR_WEAK = ['人材', '仲間', '働く', 'スタッフ募集', 'join us', 'join', 'people', 'culture', 'member', 'members'];
/** URL path/host signals. */
const URL_PATTERN = /(recruit|recruiting|recruitment|saiyo|saiyou|career|careers|jobs?|hiring|entry|employment|%e6%8e%a1%e7%94%a8|%e6%b1%82%e4%ba%ba|採用|求人|募集)/i;
/** Paths that look like recruitment but are routinely something else. */
const URL_NEGATIVE = /(news|blog|press|ir|investor|privacy|policy|contact|inquiry|sitemap|login|signin|cart|column|magazine|interview\/\d|\/tag\/|\/tags\/|\/category\/|\/archives?\/|\/author\/|\/page\/\d)/i;

const SITEMAP_STRONG = /(recruit|saiyo|saiyou|career|careers|jobs?|hiring|employment|採用|求人|募集)/i;

// ---------------------------------------------------------------------------
// deterministic stratified sampling
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sizeOf = (v) => { const m = /-?\d[\d,]*/.exec((v ?? '').trim()); return m ? Number(m[0].replace(/,/g, '')) : null; };

function sizeBand(size) {
  if (size === null) return null;
  if (size <= 0) return null;
  if (size <= 4) return '1-4人';
  if (size <= 9) return '5-9人';
  if (size <= 29) return '10-29人';
  if (size <= 99) return '30-99人';
  if (size <= 299) return '100-299人';
  if (size <= 999) return '300-999人';
  return '1000人以上';
}

function prefectureTier(pref) {
  const p = (pref ?? '').trim();
  if (p.includes('東京')) return '東京';
  if (/大阪|愛知|神奈川|福岡|埼玉|千葉|兵庫|京都|北海道/.test(p)) return '主要都市圏';
  return 'その他';
}

/**
 * Near-equal allocation across (size band × prefecture tier) cells, capped by
 * what each cell actually has. Balanced on purpose: a proportional sample would
 * be 57% Tokyo and dominated by micro firms. Population weights are emitted so
 * rates can also be read back at population level.
 */
function allocate(cells, total) {
  const quota = new Map(cells.map(([k]) => [k, 0]));
  const available = new Map(cells);
  let remaining = total;
  let active = cells.map(([k]) => k);
  while (remaining > 0 && active.length) {
    const share = Math.floor(remaining / active.length) || 1;
    let progressed = false;
    for (const k of [...active]) {
      if (remaining <= 0) break;
      const room = available.get(k) - quota.get(k);
      if (room <= 0) { active = active.filter((x) => x !== k); continue; }
      const take = Math.min(share, room, remaining);
      quota.set(k, quota.get(k) + take);
      remaining -= take;
      progressed = true;
    }
    if (!progressed) break;
  }
  return quota;
}

function buildSample(rows, size, seed) {
  const eligible = [];
  for (const r of rows) {
    const hp = (r[H.homepage] ?? '').trim();
    if (!/^https?:\/\//i.test(hp)) continue;
    const band = sizeBand(sizeOf(r[H.companySize]));
    if (!band) continue; // 0人/非開示 (34 companies) are out of the stratification
    eligible.push({
      corporateNumber: (r[H.corporateNumber] ?? '').trim(),
      company: (r[H.company] ?? '').trim(),
      prefecture: (r[H.prefecture] ?? '').trim(),
      companySize: (r[H.companySize] ?? '').trim(),
      homepageUrl: hp,
      shokubaRecruitmentUrl: (r[H.recruitmentPage] ?? '').trim() || null,
      stratum: `${band} / ${prefectureTier(r[H.prefecture])}`,
    });
  }
  // One company per homepage host, so a shared corporate site is not hit twice.
  const byHost = new Map();
  for (const e of [...eligible].sort((a, b) => a.corporateNumber.localeCompare(b.corporateNumber))) {
    const h = hostOf(e.homepageUrl);
    if (h && !byHost.has(h)) byHost.set(h, e);
  }
  const pool = [...byHost.values()];

  const cellMap = new Map();
  for (const e of pool) {
    if (!cellMap.has(e.stratum)) cellMap.set(e.stratum, []);
    cellMap.get(e.stratum).push(e);
  }
  const cells = [...cellMap.entries()].map(([k, v]) => [k, v.length]).sort((a, b) => a[0].localeCompare(b[0]));
  const quota = size === null ? new Map(cells) : allocate(cells, size);

  const rnd = mulberry32(seed);
  const picked = [];
  for (const [stratum] of cells) {
    const list = [...cellMap.get(stratum)].sort((a, b) => a.corporateNumber.localeCompare(b.corporateNumber));
    // Deterministic Fisher-Yates with a seeded PRNG.
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    const n = quota.get(stratum) ?? 0;
    const take = list.slice(0, n);
    const weight = n ? cellMap.get(stratum).length / n : null;
    for (const e of take) picked.push({ ...e, stratumPopulation: cellMap.get(stratum).length, stratumSampled: n, populationWeight: round(weight, 4) });
  }
  return {
    sample: picked.sort((a, b) => a.corporateNumber.localeCompare(b.corporateNumber)),
    frame: { eligibleWithHomepage: eligible.length, afterHostDeduplication: pool.length, cells: Object.fromEntries(cells) },
  };
}

// ---------------------------------------------------------------------------
// candidate scoring
// ---------------------------------------------------------------------------

function normalise(s) { return (s ?? '').toLowerCase().replace(/\s+/g, ''); }

function anchorSignal(label) {
  const t = normalise(label);
  if (!t) return 'none';
  if (ANCHOR_STRONG.some((w) => t.includes(normalise(w)))) return 'strong';
  if (ANCHOR_WEAK.some((w) => t.includes(normalise(w)))) return 'weak';
  return 'none';
}

function urlSignal(url) {
  let u;
  try { u = new URL(url); } catch { return { matched: false, negative: false }; }
  const target = `${u.hostname}${u.pathname}${u.search}`.toLowerCase();
  return { matched: URL_PATTERN.test(target), negative: URL_NEGATIVE.test(u.pathname.toLowerCase()) };
}

/** Scores one homepage anchor as a recruitment-page candidate. */
function scoreAnchor(anchor, homepageUrl) {
  const host = hostOf(anchor.url);
  const cat = classifyHost(anchor.url, homepageUrl);
  const sig = anchorSignal(anchor.label);
  const us = urlSignal(anchor.url);
  if (cat === 'jobPlatform') {
    // Recorded as evidence only; a third-party posting is never adopted.
    return (sig === 'strong' || us.matched)
      ? { confidence: 'low', method: 'homepageLinkToJobPlatform', score: 1, hostCategory: cat }
      : null;
  }
  const onOwnSite = cat === 'ownDomain';
  const ats = cat === 'atsHosted' || isAts(host);
  if (!onOwnSite && !ats) {
    return (sig === 'strong' && us.matched)
      ? { confidence: 'low', method: 'homepageLinkOffDomain', score: 2, hostCategory: cat }
      : null;
  }
  if (sig === 'strong' && (onOwnSite || ats)) {
    if (us.negative && !us.matched) return { confidence: 'low', method: 'homepageAnchorNegativePath', score: 2, hostCategory: cat };
    return {
      confidence: 'high',
      method: ats ? 'homepageLinkToOfficialAts' : 'homepageAnchor',
      score: us.matched ? 10 : 8,
      hostCategory: cat,
    };
  }
  if (us.matched && !us.negative && onOwnSite) {
    return { confidence: sig === 'weak' ? 'medium' : 'medium', method: 'homepageUrlPattern', score: 6, hostCategory: cat };
  }
  if (sig === 'weak' && ats) return { confidence: 'medium', method: 'homepageLinkToOfficialAts', score: 5, hostCategory: cat };
  if (us.matched && ats) return { confidence: 'medium', method: 'homepageLinkToOfficialAts', score: 5, hostCategory: cat };
  return null;
}

/** Prefers a dedicated recruitment site/section over a deep sub-page. */
function depthPenalty(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    const hostBonus = /^(recruit|saiyo|saiyou|career|careers|job|jobs|hr)\./.test(u.hostname.replace(/^www\./, '')) ? 2 : 0;
    return hostBonus - Math.min(segs.length, 5) * 0.4;
  } catch { return 0; }
}

// ---------------------------------------------------------------------------
// discovery for one company
// ---------------------------------------------------------------------------

function pageLooksLikeRecruitment(title, headings, text) {
  const hay = normalise(`${title ?? ''} ${headings.join(' ')}`);
  if (/(採用|求人|募集|recruit|career|job|hiring|entry)/i.test(hay)) return true;
  const body = text.slice(0, 4000);
  return /(募集要項|応募資格|採用情報|求人情報|エントリー|募集職種)/.test(body);
}

/**
 * Some companies register a deep sub-page as their "企業ホームページ"
 * (e.g. .../sustainability/workstyle/), so there is no global navigation to
 * read. As a single documented fallback we normalise the URL the provider
 * itself gave us down to its own origin. This is not URL brute-forcing: no
 * path is invented or enumerated, and robots.txt still applies.
 */
function rootFallbackUrl(url) {
  try {
    const u = new URL(url);
    const hasPath = u.pathname.replace(/\/+$/, '').length > 0;
    if (!hasPath) return null;
    return `${u.protocol}//${u.host}/`;
  } catch { return null; }
}

async function discoverForCompany(target, opts, { allowRootFallback = true } = {}) {
  const rec = {
    corporateNumber: target.corporateNumber || null,
    company: target.company || null,
    prefecture: target.prefecture || null,
    companySize: target.companySize || null,
    stratum: target.stratum,
    populationWeight: target.populationWeight ?? null,
    homepageUrl: target.homepageUrl,
    homepageStatus: null,
    homepageRobotsStatus: null,
    homepageError: null,
    homepageFinalUrl: null,
    recruitmentUrl: null,
    finalUrl: null,
    discoveryMethod: null,
    discoveryAnchor: null,
    hostCategory: null,
    confidence: null,
    httpStatus: null,
    robotsStatus: null,
    pageTitle: null,
    verifiedAsRecruitmentPage: null,
    candidateCount: 0,
    candidatesConsidered: null,
    sitemapsChecked: 0,
    jobPlatformLinksOnHomepage: null,
    shokubaRecruitmentUrl: target.shokubaRecruitmentUrl ?? null,
    alreadyInShokuba: Boolean(target.shokubaRecruitmentUrl),
    jobPostingJsonLdOnRecruitmentPage: null,
    rootFallbackUsed: false,
    rootFallbackUrl: null,
    rootFallbackStatus: null,
    fetchedAt: null,
    notes: [],
  };

  // --- route 1: the company homepage -------------------------------------
  let home = await fetchDocument(target.homepageUrl, opts);
  rec.homepageStatus = home.httpStatus;
  rec.homepageRobotsStatus = home.robotsStatus;
  rec.homepageError = home.error;
  rec.homepageFinalUrl = home.finalUrl;
  rec.rootFallbackUsed = false;

  const candidates = [];
  const platformLinks = new Set();

  const collectAnchors = (doc) => {
    const anchors = extractAnchors(doc.html, doc.finalUrl);
    const seen = new Set();
    for (const a of anchors) {
      const key = a.url.replace(/\/$/, '');
      if (seen.has(key)) continue;
      seen.add(key);
      const scored = scoreAnchor(a, home.finalUrl);
      if (!scored) continue;
      if (scored.hostCategory === 'jobPlatform') { platformLinks.add(hostOf(a.url)); }
      candidates.push({
        url: a.url,
        anchor: a.label || null,
        ...scored,
        score: scored.score + depthPenalty(a.url),
      });
    }
    rec.jobPlatformLinksOnHomepage = platformLinks.size ? [...platformLinks].sort() : [];
  };

  if (home.ok) {
    collectAnchors(home);
  } else {
    rec.notes.push(`homepage_not_fetched:${home.error ?? 'unknown'}`);
  }
  home.html = null;

  // Documented single fallback: the origin of the provider-supplied URL.
  const hasAdoptable = () => candidates.some((c) => c.confidence === 'high' || c.confidence === 'medium');
  if (allowRootFallback && !hasAdoptable()) {
    const rootUrl = rootFallbackUrl(home.finalUrl ?? target.homepageUrl);
    if (rootUrl && rootUrl !== (home.finalUrl ?? target.homepageUrl)) {
      const root = await fetchDocument(rootUrl, opts);
      rec.rootFallbackUsed = true;
      rec.rootFallbackUrl = rootUrl;
      rec.rootFallbackStatus = root.httpStatus;
      if (root.ok) {
        if (!home.ok) {
          // The registered URL was dead; the site root becomes the reference point.
          home = root;
          rec.homepageFinalUrl = root.finalUrl;
        }
        collectAnchors(root);
        rec.notes.push('root_fallback_used');
      } else {
        rec.notes.push(`root_fallback_failed:${root.error ?? 'unknown'}`);
      }
      root.html = null;
    }
  }

  // --- routes 2 & 3: robots.txt sitemaps ---------------------------------
  const adoptable = candidates.filter((c) => c.confidence === 'high' || c.confidence === 'medium');
  if (!adoptable.length) {
    try {
      const u = new URL(home.finalUrl ?? target.homepageUrl);
      const robots = await getRobots(`${u.protocol}//${u.host}`, opts);
      const sitemaps = (robots.sitemaps ?? []).slice(0, MAX_SITEMAPS_PER_COMPANY);
      for (const sm of sitemaps) {
        const doc = await fetchDocument(sm, opts);
        rec.sitemapsChecked += 1;
        if (!doc.ok) { doc.html = null; continue; }
        const parsed = parseSitemap(doc.html);
        doc.html = null;
        let locs = parsed.locs;
        if (parsed.isIndex) {
          const children = parsed.locs.filter((l) => SITEMAP_STRONG.test(l)).slice(0, MAX_SITEMAP_CHILDREN);
          const fallback = parsed.locs.slice(0, MAX_SITEMAP_CHILDREN);
          locs = [];
          for (const child of (children.length ? children : fallback)) {
            const cdoc = await fetchDocument(child, opts);
            rec.sitemapsChecked += 1;
            if (cdoc.ok) locs.push(...parseSitemap(cdoc.html).locs);
            cdoc.html = null;
          }
        }
        for (const loc of locs) {
          const cat = classifyHost(loc, home.finalUrl ?? target.homepageUrl);
          if (cat === 'jobPlatform') continue;
          if (cat !== 'ownDomain' && cat !== 'atsHosted') continue;
          const us = urlSignal(loc);
          if (!us.matched || us.negative) continue;
          if (!SITEMAP_STRONG.test(loc)) continue;
          candidates.push({
            url: loc,
            anchor: null,
            confidence: 'medium',
            method: 'robotsSitemap',
            hostCategory: cat,
            score: 4 + depthPenalty(loc),
          });
        }
        if (candidates.some((c) => c.method === 'robotsSitemap')) break;
      }
    } catch { /* sitemap discovery is best-effort */ }
  }

  rec.candidateCount = candidates.length;
  candidates.sort((a, b) => b.score - a.score);
  rec.candidatesConsidered = candidates.slice(0, 8).map((c) => ({
    url: c.url, anchor: c.anchor, confidence: c.confidence, method: c.method, hostCategory: c.hostCategory, score: round(c.score, 2),
  }));

  // --- route 4/5: verify the best adoptable candidate --------------------
  const ranked = candidates.filter((c) => c.confidence === 'high' || c.confidence === 'medium');
  let verifiedChosen = null;
  for (const cand of ranked.slice(0, MAX_CANDIDATE_VERIFICATIONS)) {
    const doc = await fetchDocument(cand.url, opts);
    const title = doc.ok ? extractTitle(doc.html) : null;
    const headings = doc.ok ? extractHeadings(doc.html) : [];
    const text = doc.ok ? stripToVisibleText(doc.html) : '';
    const looks = doc.ok ? pageLooksLikeRecruitment(title, headings, text) : null;
    const jp = doc.ok ? extractJobPostings(extractJsonLdBlocks(doc.html)) : null;
    doc.html = null;
    if (doc.ok && looks) {
      verifiedChosen = { cand, doc, title, jp };
      break;
    }
    if (!verifiedChosen) verifiedChosen = { cand, doc, title, jp, rejected: true };
  }

  if (verifiedChosen) {
    const { cand, doc, title, jp, rejected } = verifiedChosen;
    rec.recruitmentUrl = cand.url;
    rec.finalUrl = doc.finalUrl;
    rec.discoveryMethod = cand.method;
    rec.discoveryAnchor = cand.anchor;
    rec.hostCategory = classifyHost(doc.finalUrl ?? cand.url, target.homepageUrl);
    rec.httpStatus = doc.httpStatus;
    rec.robotsStatus = doc.robotsStatus;
    rec.pageTitle = title;
    rec.fetchedAt = doc.fetchedAt;
    rec.jobPostingJsonLdOnRecruitmentPage = jp ? jp.hasJobPosting : null;
    rec.verifiedAsRecruitmentPage = doc.ok ? Boolean(!rejected) : null;
    // A candidate that did not verify is downgraded, never silently adopted.
    if (!doc.ok) {
      rec.confidence = 'low';
      rec.notes.push(`candidate_not_fetched:${doc.error ?? 'unknown'}`);
    } else if (rejected) {
      rec.confidence = 'low';
      rec.notes.push('page_did_not_look_like_recruitment');
    } else if (rec.hostCategory === 'jobPlatform') {
      rec.confidence = 'low';
      rec.notes.push('redirected_into_job_platform');
    } else {
      rec.confidence = cand.confidence;
    }
  } else if (candidates.length) {
    const best = candidates[0];
    rec.recruitmentUrl = best.url;
    rec.discoveryMethod = best.method;
    rec.discoveryAnchor = best.anchor;
    rec.hostCategory = best.hostCategory;
    rec.confidence = 'low';
    rec.notes.push('only_low_confidence_candidates');
  } else {
    rec.notes.push(home.ok ? 'no_candidate_found' : 'homepage_unavailable');
  }

  if (!rec.notes.length) rec.notes = null;
  return rec;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { sample: 300, seed: 20261004, concurrency: 8, outTag: null, all: false, dryRun: false, retryUnresolved: null, noRootFallback: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--retry-unresolved') out.retryUnresolved = argv[++i];
    else if (a === '--no-root-fallback') out.noRootFallback = true;
    else if (a === '--sample') out.sample = Number(argv[++i]);
    else if (a === '--seed') out.seed = Number(argv[++i]);
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (a === '--out-tag') out.outTag = argv[++i];
    else if (a === '--all') out.all = true;
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tag = args.outTag ?? (args.all ? 'all' : String(args.sample));
  const outJson = path.join(DIR, `${RUN_DATE}-discovery-${tag}.json`);
  const outCsv = path.join(DIR, `${RUN_DATE}-discovery-${tag}.csv`);
  const outSample = path.join(DIR, `${RUN_DATE}-discovery-sample-${tag}.csv`);

  // Re-run only the companies a previous pass could not resolve, so the
  // effect of a discovery change can be measured without re-crawling
  // the sites that already answered.
  if (args.retryUnresolved) {
    const prevPath = path.join(DIR, `${RUN_DATE}-discovery-${args.retryUnresolved}.json`);
    const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
    const unresolved = prev.results.filter((r) => r.confidence !== 'high' && r.confidence !== 'medium');
    const opts = { ...DEFAULTS };
    const started = Date.now();
    let n = 0;
    const retried = await runPool(unresolved, args.concurrency, async (r) => {
      const res = await discoverForCompany({
        corporateNumber: r.corporateNumber, company: r.company, prefecture: r.prefecture,
        companySize: r.companySize, homepageUrl: r.homepageUrl, stratum: r.stratum,
        populationWeight: r.populationWeight, shokubaRecruitmentUrl: r.shokubaRecruitmentUrl,
      }, opts, { allowRootFallback: !args.noRootFallback });
      n += 1;
      process.stderr.write(`[retry ${n}/${unresolved.length}] ${String(res.confidence ?? 'none').padEnd(6)} ${res.recruitmentUrl ?? res.homepageUrl}\n`);
      return res;
    });
    const resolved = retried.filter((r) => r.confidence === 'high' || r.confidence === 'medium');
    const outPath = path.join(DIR, `${RUN_DATE}-discovery-${args.retryUnresolved}-retry.json`);
    fs.writeFileSync(outPath, `${JSON.stringify({
      runDate: RUN_DATE,
      stage: 'stage4-discovery-retry',
      generator: 'scripts/research-discover-recruitment.mjs --retry-unresolved',
      basedOn: prevPath,
      purpose: '前パスで未解決だった企業のみ再探索し、サイトルートへのフォールバック追加の効果を測る',
      generatedAtUtc: new Date(started).toISOString(),
      elapsedSeconds: round((Date.now() - started) / 1000, 1),
      rootFallbackEnabled: !args.noRootFallback,
      previousCounts: { total: prev.results.length, unresolved: unresolved.length, adopted: prev.results.length - unresolved.length },
      retryCounts: {
        attempted: unresolved.length,
        nowAdopted: resolved.length,
        high: retried.filter((r) => r.confidence === 'high').length,
        medium: retried.filter((r) => r.confidence === 'medium').length,
        rootFallbackUsed: retried.filter((r) => r.rootFallbackUsed).length,
        adoptedViaRootFallback: resolved.filter((r) => r.rootFallbackUsed).length,
      },
      combinedIfMerged: {
        adopted: (prev.results.length - unresolved.length) + resolved.length,
        of: prev.results.length,
        rate: round(rate((prev.results.length - unresolved.length) + resolved.length, prev.results.length)),
      },
      results: retried,
    }, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({
      out: outPath,
      attempted: unresolved.length,
      nowAdopted: resolved.length,
      adoptedViaRootFallback: resolved.filter((r) => r.rootFallbackUsed).length,
      combinedAdopted: (prev.results.length - unresolved.length) + resolved.length,
      combinedRate: round(rate((prev.results.length - unresolved.length) + resolved.length, prev.results.length)),
    }, null, 2));
    return;
  }

  const rows = readCsvObjects(SEED_PATH);
  const { sample, frame } = buildSample(rows, args.all ? null : args.sample, args.seed);

  writeCsv(outSample, [
    'corporateNumber', 'company', 'prefecture', 'companySize', 'stratum',
    'stratumPopulation', 'stratumSampled', 'populationWeight', 'homepageUrl', 'shokubaRecruitmentUrl',
  ], sample);

  if (args.dryRun) {
    console.log(JSON.stringify({
      frame,
      sampleSize: sample.length,
      strata: Object.entries(sample.reduce((a, s) => { a[s.stratum] = (a[s.stratum] ?? 0) + 1; return a; }, {})).sort(),
      sampleFile: outSample,
    }, null, 2));
    return;
  }

  const opts = { ...DEFAULTS };
  const started = Date.now();
  let done = 0;
  const results = await runPool(sample, args.concurrency, async (t) => {
    const r = await discoverForCompany(t, opts, { allowRootFallback: !args.noRootFallback });
    done += 1;
    process.stderr.write(`[${done}/${sample.length}] ${String(r.confidence ?? 'none').padEnd(6)} ${String(r.discoveryMethod ?? '-').padEnd(28)} ${r.recruitmentUrl ?? r.homepageUrl}\n`);
    return r;
  });
  const elapsedSeconds = round((Date.now() - started) / 1000, 1);

  const byConfidence = (c) => results.filter((r) => r.confidence === c).length;
  const homepageOk = results.filter((r) => r.homepageStatus === 200 && !r.homepageError).length;
  const adopted = results.filter((r) => r.confidence === 'high' || r.confidence === 'medium');
  const countBy = (arr, fn) => arr.reduce((a, r) => { const k = String(fn(r) ?? 'null'); a[k] = (a[k] ?? 0) + 1; return a; }, {});

  const payload = {
    runDate: RUN_DATE,
    stage: 'stage4-discovery',
    generator: 'scripts/research-discover-recruitment.mjs',
    generatedAtUtc: new Date(started).toISOString(),
    finishedAtUtc: new Date().toISOString(),
    elapsedSeconds,
    sampling: {
      strategy: '企業規模7区分 × 都道府県3区分の21セルへ均等割当（上限はセルの実数）。比例配分だと東京57%・零細企業偏重になるため均等化し、populationWeight で母集団換算も可能にしている。',
      seed: args.seed,
      frame,
      sampleSize: sample.length,
      strata: countBy(sample, (s) => s.stratum),
      sampleFile: outSample,
      excluded: '企業規模が0人/非開示の34社は層化対象外',
    },
    settings: { userAgent: USER_AGENT, ...opts, concurrency: args.concurrency },
    counts: {
      companies: results.length,
      homepageFetchSuccess: homepageOk,
      homepageFetchFailure: results.length - homepageOk,
      recruitmentPageFound: adopted.length,
      high: byConfidence('high'),
      medium: byConfidence('medium'),
      low: byConfidence('low'),
      none: results.filter((r) => r.confidence === null).length,
      officialAts: results.filter((r) => (r.confidence === 'high' || r.confidence === 'medium') && r.hostCategory === 'atsHosted').length,
      jobPostingJsonLdOnRecruitmentPage: adopted.filter((r) => r.jobPostingJsonLdOnRecruitmentPage === true).length,
      alreadyInShokubaRecruitmentColumn: results.filter((r) => r.alreadyInShokuba).length,
      newlyDiscoveredNotInShokuba: adopted.filter((r) => !r.alreadyInShokuba).length,
    },
    accessOutcomes: {
      homepageStatusCounts: countBy(results, (r) => r.homepageStatus),
      homepageErrorCounts: countBy(results.filter((r) => r.homepageError), (r) => r.homepageError),
      recruitmentStatusCounts: countBy(results.filter((r) => r.httpStatus !== null), (r) => r.httpStatus),
      http403: results.filter((r) => r.homepageStatus === 403 || r.httpStatus === 403).length,
      http429: results.filter((r) => r.homepageStatus === 429 || r.httpStatus === 429).length,
      robotsBlocked: results.filter((r) => r.homepageRobotsStatus === 'blocked' || r.robotsStatus === 'blocked').length,
      robotsStatusCounts: countBy(results, (r) => r.homepageRobotsStatus),
      sitemapsChecked: results.reduce((a, r) => a + r.sitemapsChecked, 0),
    },
    discoveryMethodCounts: countBy(results, (r) => r.discoveryMethod),
    hostCategoryCounts: countBy(adopted, (r) => r.hostCategory),
    methodNotes: [
      '発見経路は企業トップページのリンク、robots.txt の Sitemap、その sitemap 内URL、自社サイト内の採用ページ、企業サイトから直接リンクされた公式ATSのみ。',
      'URL総当たり・検索エンジンのスクレイピング・bot対策回避は行っていない。',
      'robots.txt の明示的 Disallow はリダイレクト各ホップで再評価し、拒否されたURLは取得しない。',
      '第三者求人媒体へのリンクは事実として記録するだけで、採用ページとして採用（adopt）しない。',
      'confidence low は本分析に自動採用しない。',
      '取得できなかった値は null。0 や false で埋めていない。',
    ],
    results,
  };

  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  writeCsv(outCsv, [
    'corporateNumber', 'company', 'prefecture', 'companySize', 'stratum', 'populationWeight',
    'homepageUrl', 'homepageStatus', 'homepageRobotsStatus', 'homepageError',
    'recruitmentUrl', 'finalUrl', 'discoveryMethod', 'discoveryAnchor', 'hostCategory',
    'confidence', 'httpStatus', 'robotsStatus', 'pageTitle', 'verifiedAsRecruitmentPage',
    'candidateCount', 'sitemapsChecked', 'jobPostingJsonLdOnRecruitmentPage',
    'rootFallbackUsed', 'rootFallbackUrl', 'rootFallbackStatus',
    'shokubaRecruitmentUrl', 'alreadyInShokuba', 'fetchedAt',
  ], results.map((r) => ({ ...r, notes: null })));

  console.log(JSON.stringify({ out: [outJson, outCsv, outSample], elapsedSeconds, counts: payload.counts, access: payload.accessOutcomes }, null, 2));
}

main().catch((e) => { console.error(`ERROR: ${e?.stack ?? e}`); process.exit(1); });
