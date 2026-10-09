#!/usr/bin/env node
/**
 * NARU Research: Golden Set tooling for stage 5.
 *
 * Two subcommands:
 *
 *   digest  — fetch a selection of recruitment pages once, cache the HTML
 *             OUTSIDE the repository, and print a neutral structural digest
 *             (headings, table/dl labels, role-like anchors, JSON-LD presence).
 *             The digest is what a human annotates; no page body is committed.
 *
 *   eval    — run the stage 5 extractor against the annotated golden set and
 *             report precision / recall / misadoption / duplicate / confidence,
 *             plus the two named regression checks. Uses the cache, so tuning
 *             the extractor costs zero requests.
 *
 * Usage:
 *   node scripts/research-golden.mjs digest --tag 300 --count 60 --seed 20261004
 *   node scripts/research-golden.mjs eval
 *
 * The cache directory defaults to NARU_GOLDEN_CACHE or a temp folder; it is
 * never inside the repo, so no HTML is ever committed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  fetchDocument, extractBlocks, headingSections, rowsWithin, extractTitle, stripToVisibleText,
  extractJsonLdBlocks, extractJobPostings, extractAnchors, runPool, round, rate, DEFAULTS,
} from './research-web.mjs';
import {
  extractCandidatesFromPage, isAnalysisRecord, classifyTitle, normaliseTitleKey,
  ROLE_TOKENS, assignDuplicateGroups, norm,
} from './research-jobs.mjs';

const RUN_DATE = '2026-10-04';
const DIR = path.join('data', 'research', 'shokuba');
const GOLDEN_PATH = path.join(DIR, `${RUN_DATE}-golden-set-50.json`);
const DIGEST_PATH = path.join(DIR, `${RUN_DATE}-golden-digest.json`);
const EVAL_PATH = path.join(DIR, `${RUN_DATE}-golden-eval.json`);

const CACHE_DIR = process.env.NARU_GOLDEN_CACHE
  ?? path.join(os.tmpdir(), 'naru-golden-cache');

const cachePath = (url) => path.join(CACHE_DIR, `${crypto.createHash('sha1').update(url).digest('hex')}.html`);

function readCache(url) {
  const p = cachePath(url);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function writeCache(url, html) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(url), html, 'utf8');
}

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

// ---------------------------------------------------------------------------
// digest
// ---------------------------------------------------------------------------

/** Neutral description of a page's structure, for human annotation. */
function digestPage(html, doc) {
  const blocks = extractBlocks(html);
  const sections = headingSections(blocks);
  const text = stripToVisibleText(blocks.masked);
  const jsonLd = extractJobPostings(extractJsonLdBlocks(html));
  const labelRows = rowsWithin(blocks, 0, blocks.masked.length)
    .filter((r) => r.label)
    .map((r) => ({ label: norm(r.label).slice(0, 40), value: r.value ? norm(r.value).slice(0, 80) : null }));
  const roleAnchors = extractAnchors(html, doc.finalUrl)
    .filter((a) => a.text && ROLE_TOKENS.test(a.text))
    .map((a) => ({ text: a.text.slice(0, 60), url: a.url }))
    .slice(0, 30);
  return {
    url: doc.finalUrl,
    httpStatus: doc.httpStatus,
    pageTitle: extractTitle(html),
    visibleChars: text.length,
    jsonLdJobPostings: jsonLd.postings.length,
    jsonLdJobTitles: jsonLd.postings.map((p) => p.title).filter(Boolean).slice(0, 20),
    headings: blocks.headings
      .filter((h) => h.level <= 4)
      .map((h) => ({ level: h.level, text: h.text.slice(0, 80), titleClass: classifyTitle(h.text) }))
      .slice(0, 60),
    sectionsWithJobFields: sections
      .filter((s) => /(仕事内容|業務内容|職務内容|給与|月給|年収|勤務地|雇用形態|応募資格)/.test(s.text))
      .map((s) => ({ level: s.level, heading: s.heading.slice(0, 80), titleClass: classifyTitle(s.heading), chars: s.textLength }))
      .slice(0, 40),
    tableAndDlLabels: labelRows.slice(0, 50),
    roleLikeAnchors: roleAnchors,
    tableCount: blocks.tables.length,
    dlCount: blocks.defLists.length,
  };
}

/** Pre-bucket guess, only to make the selection cover different shapes. */
function guessStructureType(d, companyRow) {
  if (companyRow.hostCategory === 'atsHosted') return 'ats';
  if (d.visibleChars < 400) return 'js_dependent';
  if (d.jsonLdJobPostings > 0) return 'jsonld';
  const roleSections = d.sectionsWithJobFields.filter((s) => s.titleClass === 'role').length;
  if (roleSections >= 2) return 'multi_role_single_page';
  if (d.roleLikeAnchors.length >= 2) return 'detail_links';
  const hay = `${d.pageTitle ?? ''} ${d.headings.map((h) => h.text).join(' ')}`;
  const newGrad = /新卒/.test(hay);
  const midCareer = /(中途|キャリア採用|経験者)/.test(hay);
  if (newGrad && !midCareer) return 'new_grad_only';
  if (midCareer && !newGrad) return 'mid_career_only';
  if (roleSections === 1) return 'single_role';
  return 'no_jobs_top';
}

/**
 * `--urls file.json` digests an explicit list instead of a sample. Used to add
 * real job-detail pages (harvested from the sampled pages' own role links) to
 * the golden set, so precision is measured on detail pages too.
 */
async function cmdDigestUrls(args) {
  const list = JSON.parse(fs.readFileSync(args.urls, 'utf8'));
  const opts = { ...DEFAULTS };
  let done = 0;
  const digests = await runPool(list, args.concurrency, async (item) => {
    let html = readCache(item.url);
    let doc = { finalUrl: item.url, httpStatus: 200, robotsStatus: 'cached', fetchedAt: null };
    if (!html) {
      const fetched = await fetchDocument(item.url, opts);
      if (fetched.ok) { html = fetched.html; writeCache(item.url, html); }
      doc = { finalUrl: fetched.finalUrl ?? item.url, httpStatus: fetched.httpStatus, robotsStatus: fetched.robotsStatus, fetchedAt: fetched.fetchedAt };
      fetched.html = null;
    }
    done += 1;
    if (!html) {
      process.stderr.write(`[${done}/${list.length}] FAILED ${item.url}\n`);
      return { ...item, failed: true };
    }
    const d = digestPage(html, doc);
    process.stderr.write(`[${done}/${list.length}] h=${d.headings.length} sec=${d.sectionsWithJobFields.length} ${item.url}\n`);
    return { ...item, guessedStructureType: item.structureType ?? 'job_detail_page', ...d };
  });
  const outPath = path.join(DIR, `${RUN_DATE}-golden-digest-extra.json`);
  fs.writeFileSync(outPath, `${JSON.stringify({ runDate: RUN_DATE, note: '明示URLリストの構造ダイジェスト（求人詳細ページ）。', cacheDir: CACHE_DIR, digests }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ out: outPath, fetched: digests.filter((d) => !d.failed).length, failed: digests.filter((d) => d.failed).length }, null, 2));
}

async function cmdDigest(args) {
  if (args.urls) return cmdDigestUrls(args);
  const discovery = JSON.parse(fs.readFileSync(path.join(DIR, `${RUN_DATE}-discovery-${args.tag}.json`), 'utf8'));
  const eligible = discovery.results.filter((r) => (
    (r.confidence === 'high' || r.confidence === 'medium')
    && ['ownDomain', 'atsHosted'].includes(r.hostCategory)
    && r.verifiedAsRecruitmentPage === true
  ));

  // Deterministic shuffle, but keep every ATS page: there are only three.
  const ats = eligible.filter((r) => r.hostCategory === 'atsHosted');
  const rest = eligible.filter((r) => r.hostCategory !== 'atsHosted');
  const rnd = mulberry32(args.seed);
  const shuffled = [...rest].sort((a, b) => (a.corporateNumber ?? '').localeCompare(b.corporateNumber ?? ''));
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const selection = [...ats, ...shuffled].slice(0, args.count);

  const opts = { ...DEFAULTS };
  let done = 0;
  const digests = await runPool(selection, args.concurrency, async (r) => {
    const url = r.finalUrl ?? r.recruitmentUrl;
    let html = readCache(url);
    let doc = { finalUrl: url, httpStatus: null, robotsStatus: null, fetchedAt: null };
    if (!html) {
      const fetchedDoc = await fetchDocument(url, opts);
      if (fetchedDoc.ok) {
        html = fetchedDoc.html;
        writeCache(url, html);
      }
      doc = { finalUrl: fetchedDoc.finalUrl ?? url, httpStatus: fetchedDoc.httpStatus, robotsStatus: fetchedDoc.robotsStatus, fetchedAt: fetchedDoc.fetchedAt };
      fetchedDoc.html = null;
    } else {
      doc.httpStatus = 200;
      doc.robotsStatus = 'cached';
    }
    done += 1;
    if (!html) {
      process.stderr.write(`[${done}/${selection.length}] FAILED ${url}\n`);
      return { company: r.company, corporateNumber: r.corporateNumber, url, failed: true };
    }
    const d = digestPage(html, doc);
    const guess = guessStructureType(d, r);
    process.stderr.write(`[${done}/${selection.length}] ${guess.padEnd(24)} h=${d.headings.length} sec=${d.sectionsWithJobFields.length} anc=${d.roleLikeAnchors.length} ${url}\n`);
    return {
      company: r.company,
      corporateNumber: r.corporateNumber,
      stratum: r.stratum,
      hostCategory: r.hostCategory,
      guessedStructureType: guess,
      ...d,
    };
  });

  fs.writeFileSync(DIGEST_PATH, `${JSON.stringify({
    runDate: RUN_DATE,
    note: '人間が期待値を付けるための中立な構造ダイジェスト。HTML全文はリポジトリに保存していない（キャッシュは外部ディレクトリ）。',
    cacheDir: CACHE_DIR,
    selection: { tag: args.tag, count: args.count, seed: args.seed },
    guessedTypeCounts: digests.reduce((a, d) => { const k = d.guessedStructureType ?? 'failed'; a[k] = (a[k] ?? 0) + 1; return a; }, {}),
    digests,
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    out: DIGEST_PATH,
    cacheDir: CACHE_DIR,
    fetched: digests.filter((d) => !d.failed).length,
    failed: digests.filter((d) => d.failed).length,
    guessedTypeCounts: digests.reduce((a, d) => { const k = d.guessedStructureType ?? 'failed'; a[k] = (a[k] ?? 0) + 1; return a; }, {}),
  }, null, 2));
}

// ---------------------------------------------------------------------------
// eval
// ---------------------------------------------------------------------------

const PREFECTURES_FOR_CHECK = ['北海道', '東京都', '京都府', '大阪府', ...['青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'].map((p) => `${p}県`)];

/** Expected and predicted titles match if either contains the other. */
function titlesMatch(expected, predicted) {
  const a = normaliseTitleKey(expected);
  const b = normaliseTitleKey(predicted);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

async function cmdEval(args) {
  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  const opts = { ...DEFAULTS };
  let done = 0;

  const perPage = await runPool(golden.pages, args.concurrency, async (g) => {
    let html = readCache(g.url);
    let doc = { finalUrl: g.url, httpStatus: 200, robotsStatus: 'cached', fetchedAt: null };
    if (!html) {
      const fetched = await fetchDocument(g.url, opts);
      if (fetched.ok) { html = fetched.html; writeCache(g.url, html); }
      doc = { finalUrl: fetched.finalUrl ?? g.url, httpStatus: fetched.httpStatus, robotsStatus: fetched.robotsStatus, fetchedAt: fetched.fetchedAt };
      fetched.html = null;
    }
    done += 1;
    if (!html) return { ...g, failed: true };

    const { candidates } = extractCandidatesFromPage({
      html, doc, company: g.company, corporateNumber: g.corporateNumber,
      isIndexPage: g.structureType === 'detail_links',
    });
    assignDuplicateGroups(candidates);
    const predicted = candidates.filter(isAnalysisRecord);
    const pageText = stripToVisibleText(extractBlocks(html).masked);

    const expectedTitles = g.expectedJobTitles ?? [];
    const matchedExpected = expectedTitles.filter((e) => predicted.some((p) => titlesMatch(e, p.jobTitle)));
    const truePositives = predicted.filter((p) => expectedTitles.some((e) => titlesMatch(e, p.jobTitle)));
    const falsePositives = predicted.filter((p) => !expectedTitles.some((e) => titlesMatch(e, p.jobTitle)));
    const containerAdopted = predicted.filter((p) => ['container', 'category'].includes(classifyTitle(p.jobTitle ?? '')));
    const dupWithinPage = predicted.filter((p) => p.isDuplicateOfEarlierRecord);
    const recruitBug = predicted.filter((p) => /^(recruit|採用情報|recruit採用情報|採用情報recruit)$/i.test(normaliseTitleKey(p.jobTitle ?? '')));
    // The named bug class: a prefecture produced by substring matching that the
    // page never mentions (e.g. 京都府 invented from 「東京都渋谷区」).
    // Only prefecture tokens are judged; a street address from JSON-LD need not
    // appear in the visible text.
    const hay = norm(pageText);
    const locationBug = predicted.filter((p) => {
      if (!p.location) return false;
      const named = PREFECTURES_FOR_CHECK.filter((pref) => p.location.includes(pref));
      return named.some((pref) => !hay.includes(pref) && !hay.includes(pref.replace(/[都道府県]$/, '')));
    });

    process.stderr.write(`[${done}/${golden.pages.length}] exp=${expectedTitles.length} pred=${predicted.length} tp=${truePositives.length} fp=${falsePositives.length} ${g.url}\n`);
    return {
      url: g.url,
      company: g.company,
      structureType: g.structureType,
      expectedJobCount: g.expectedJobCount,
      expectedJobTitles: expectedTitles,
      predictedJobCount: predicted.length,
      predictedTitles: predicted.map((p) => ({ title: p.jobTitle, recordType: p.recordType, evidence: p.jobTitleEvidence, confidence: p.jobTitleConfidence })),
      truePositives: truePositives.length,
      falsePositives: falsePositives.map((p) => ({ title: p.jobTitle, recordType: p.recordType, evidence: p.jobTitleEvidence })),
      matchedExpected: matchedExpected.length,
      missedExpected: expectedTitles.filter((e) => !matchedExpected.includes(e)),
      containerOrCategoryAdopted: containerAdopted.map((p) => p.jobTitle),
      duplicatesWithinPage: dupWithinPage.length,
      recruitTitleBug: recruitBug.map((p) => p.jobTitle),
      locationBug: locationBug.map((p) => ({ title: p.jobTitle, location: p.location })),
      highMediumConfidence: predicted.filter((p) => ['high', 'medium'].includes(p.jobTitleConfidence)).length,
      allCandidateTypes: candidates.reduce((a, c) => { a[c.recordType] = (a[c.recordType] ?? 0) + 1; return a; }, {}),
    };
  });

  const ok = perPage.filter((p) => !p.failed);
  const sum = (fn) => ok.reduce((a, p) => a + fn(p), 0);
  const predictedTotal = sum((p) => p.predictedJobCount);
  const tpTotal = sum((p) => p.truePositives);
  const expectedTotal = sum((p) => p.expectedJobTitles.length);
  const matchedTotal = sum((p) => p.matchedExpected);
  const containerTotal = sum((p) => p.containerOrCategoryAdopted.length);
  const dupTotal = sum((p) => p.duplicatesWithinPage);
  const confTotal = sum((p) => p.highMediumConfidence);
  const recruitBugTotal = sum((p) => p.recruitTitleBug.length);
  const locationBugTotal = sum((p) => p.locationBug.length);

  const metrics = {
    pagesEvaluated: ok.length,
    pagesFailed: perPage.length - ok.length,
    expectedJobTitles: expectedTotal,
    predictedJobRecords: predictedTotal,
    truePositives: tpTotal,
    jobLevelPrecision: round(rate(tpTotal, predictedTotal)),
    jobLevelRecall: round(rate(matchedTotal, expectedTotal)),
    containerOrCategoryAdoptionRate: round(rate(containerTotal, predictedTotal)),
    duplicateRate: round(rate(dupTotal, predictedTotal)),
    highMediumConfidenceRate: round(rate(confTotal, predictedTotal)),
    knownRecruitTitleBugCount: recruitBugTotal,
    knownLocationSubstringBugCount: locationBugTotal,
    byStructureType: Object.fromEntries(
      [...new Set(ok.map((p) => p.structureType))].sort().map((t) => {
        const rows = ok.filter((p) => p.structureType === t);
        const pred = rows.reduce((a, p) => a + p.predictedJobCount, 0);
        const tp = rows.reduce((a, p) => a + p.truePositives, 0);
        const exp = rows.reduce((a, p) => a + p.expectedJobTitles.length, 0);
        const mat = rows.reduce((a, p) => a + p.matchedExpected, 0);
        return [t, { pages: rows.length, expected: exp, predicted: pred, truePositives: tp, precision: round(rate(tp, pred)), recall: round(rate(mat, exp)) }];
      }),
    ),
  };

  const gates = {
    'job-level precision >= 0.90': metrics.jobLevelPrecision !== null && metrics.jobLevelPrecision >= 0.9,
    'container/category adoption <= 0.05': metrics.containerOrCategoryAdoptionRate !== null && metrics.containerOrCategoryAdoptionRate <= 0.05,
    'duplicate rate <= 0.05': metrics.duplicateRate !== null && metrics.duplicateRate <= 0.05,
    'title high|medium >= 0.90': metrics.highMediumConfidenceRate !== null && metrics.highMediumConfidenceRate >= 0.9,
    'known "Recruit 採用情報" bug == 0': recruitBugTotal === 0,
    'known location substring bug == 0': locationBugTotal === 0,
  };
  const allPassed = Object.values(gates).every(Boolean);

  fs.writeFileSync(EVAL_PATH, `${JSON.stringify({
    runDate: RUN_DATE,
    stage: 'stage5-golden-eval',
    generator: 'scripts/research-golden.mjs eval',
    generatedAtUtc: new Date().toISOString(),
    goldenSet: path.basename(GOLDEN_PATH),
    metrics,
    gates,
    allGatesPassed: allPassed,
    note: 'precision = 期待職種に一致した求人レコード / 生成した求人レコード。recall = 一致した期待職種 / 期待職種。judgementは golden-set-50.json の期待値に対する機械評価。',
    pages: perPage,
  }, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ out: EVAL_PATH, metrics, gates, allGatesPassed: allPassed }, null, 2));
}

// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { cmd: argv[0], tag: '300', count: 60, seed: 20261004, concurrency: 6, urls: null };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--urls') out.urls = argv[++i];
    else if (a === '--tag') out.tag = argv[++i];
    else if (a === '--count') out.count = Number(argv[++i]);
    else if (a === '--seed') out.seed = Number(argv[++i]);
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.cmd === 'digest') return cmdDigest(args);
  if (args.cmd === 'eval') return cmdEval(args);
  throw new Error('Usage: research-golden.mjs <digest|eval> [--tag 300] [--count 60] [--seed N]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`ERROR: ${e?.stack ?? e}`); process.exit(1); });
}
