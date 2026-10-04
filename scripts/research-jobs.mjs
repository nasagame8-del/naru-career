#!/usr/bin/env node
/**
 * NARU Research stage 5: break the discovered recruitment pages down into
 * ONE RECORD PER JOB.
 *
 * Input:  data/research/shokuba/<date>-discovery-<tag>.json (stage 4)
 * Output: data/research/shokuba/<date>-jobs-<tag>.json / .csv
 *
 * Only companies whose recruitment page was adopted at confidence high or
 * medium, on their own domain or an official ATS, are processed. `low` is
 * never auto-adopted.
 *
 * Rules:
 * - JobPosting JSON-LD is authoritative; HTML is a fallback/complement only
 * - no job body text is stored. Only the structured fields below, and short
 *   requirement excerpts capped at 160 characters
 * - unknown values stay null. Nothing is inferred, nothing is defaulted to 0
 * - links are followed only where the recruitment page itself links them:
 *   one optional job-index hop, then job detail pages, capped per company
 * - third-party job media are never followed
 * - robots.txt, per-host serialisation and the response cap come from
 *   research-web.mjs and apply to every request here
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  writeCsv, fetchDocument, extractAnchors, extractTitle, extractHeadings, stripToVisibleText,
  extractJsonLdBlocks, extractJobPostings, classifyHost, hostOf, registrableDomain, isAts,
  matchFlags, nullFlags, runPool, median, round, rate, DEFAULTS, USER_AGENT,
} from './research-web.mjs';

const RUN_DATE = '2026-10-04';
const DIR = path.join('data', 'research', 'shokuba');

const MAX_JOBS_PER_COMPANY = 8;
const MAX_INDEX_HOPS = 1;
const REQUIREMENT_EXCERPT_CHARS = 160;

const JOB_INDEX_WORDS = ['募集要項', '募集職種', '求人一覧', '職種一覧', '募集一覧', '仕事を探す', '募集中の職種', 'job list', 'positions', 'openings', 'all jobs'];
/** Explicit requirement headings only. Bare 「必須」「歓迎」 match inside prose. */
const REQUIRED_LABELS = ['必須スキル', '必須条件', '必須要件', '応募資格', '応募要件', '必要なスキル', '求める経験', '求める人材', '応募条件'];
const PREFERRED_LABELS = ['歓迎スキル', '歓迎条件', '歓迎要件', '歓迎する経験', 'あると望ましい', 'あれば歓迎', '尚可'];
/** An excerpt stops at the next section-like label so it stays a field, not a body. */
const EXCERPT_STOP = /(歓迎スキル|歓迎条件|歓迎要件|給与|給料|月給|年収|待遇|福利厚生|勤務地|勤務時間|雇用形態|選考|応募方法|お問い合わせ|CONTACT|エントリー|Tel|TEL|電話|©|&copy;)/;
const JOB_TITLE_TOKENS = /(エンジニア|プログラマ|システムエンジニア|\bSE\b|\bPG\b|ディレクター|デザイナー|マーケ|営業|コンサル|プランナー|オペレーター|技術職|総合職|開発|運用保守|インフラ|ネットワーク|サーバ|データ|アナリスト|ＰＭ|\bPM\b|\bPMO\b|ライター|編集|企画|事務|サポート|カスタマーサクセス|研究|保守|テスター|\bQA\b)/;
const JOB_DETAIL_PATH = /(recruit|saiyo|saiyou|career|careers|jobs?|occupation|position|offer|entry|employment|募集|求人|職種)/i;
const NOT_A_JOB_PATH = /(privacy|policy|contact|inquiry|news|blog|press|faq|sitemap|login|mypage|graduate\/?$|\/tag\/|\/category\/|interview|people|member|staff|voice|crosstalk|zadankai|benefit|welfare|flow|faq|entryform|entry-form|message|culture|environment|training\/?$|\.(pdf|jpg|png|zip|docx?|xlsx?)$)/i;
/**
 * Pages that live inside a recruitment site but are not a posting. Without this
 * the HTML route turns 社員インタビュー / エントリーフォーム / 採用情報トップ
 * into "jobs", which breaks the one-record-per-job contract.
 */
const NOT_A_JOB_TITLE = /(社員インタビュー|インタビュー|座談会|対談|先輩社員|社員紹介|数字で見る|エントリーフォーム|エントリーシート|よくある質問|\bFAQ\b|会社説明会|選考フロー|選考の流れ|福利厚生|教育制度|研修制度|会社概要|企業情報|プライバシー|お問い合わせ|個人情報|サイトマップ|internship$|インターンシップ$)/i;
/** Generic recruitment-site furniture; acceptable only if nothing better exists. */
const GENERIC_JOB_TITLE = /^(採用情報|採用サイト|採用について|採用ページ|リクルート|recruit(ing|ment)?|careers?|求人情報|募集要項|職種紹介|新卒採用情報|中途採用情報|エントリー)$/i;

const EMPLOYMENT_TYPES = ['正社員', '契約社員', '業務委託', 'アルバイト', 'パート', '派遣社員', '嘱託', 'インターン', '時短勤務', '試用期間'];
const PREFECTURE_BASES = ['青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'];
/**
 * Full forms are matched first on purpose: "東京都渋谷区" contains the
 * substring "京都", so bare-name matching alone invents a second prefecture.
 */
const PREFECTURES_FULL = ['北海道', '東京都', '京都府', '大阪府', ...PREFECTURE_BASES.map((p) => `${p}県`)];

// ---------------------------------------------------------------------------
// HTML field extraction (fallback only)
// ---------------------------------------------------------------------------

const norm = (s) => (s ?? '').normalize('NFKC').replace(/\s+/g, ' ');

/** Annual/monthly pay stated explicitly on the page. Returns nulls otherwise. */
export function extractSalary(text) {
  const t = norm(text);
  const out = { salaryMin: null, salaryMax: null, salaryUnit: null, salarySource: null };
  const yearRange = /年[収間][^0-9]{0,14}(\d{3,5})\s*万[^0-9]{0,8}(?:[~〜～ー–—-]|から)\s*(\d{3,5})\s*万/.exec(t);
  if (yearRange) {
    out.salaryMin = Number(yearRange[1]) * 10_000;
    out.salaryMax = Number(yearRange[2]) * 10_000;
    out.salaryUnit = 'YEAR';
    out.salarySource = 'html:年収レンジ';
    return out;
  }
  const yearSingle = /年[収間][^0-9]{0,14}(\d{3,5})\s*万/.exec(t);
  if (yearSingle) {
    out.salaryMin = Number(yearSingle[1]) * 10_000;
    out.salaryUnit = 'YEAR';
    out.salarySource = 'html:年収下限のみ';
    return out;
  }
  const monthRangeMan = /月[給額収][^0-9]{0,14}(\d{2,3})\s*万[^0-9]{0,8}(?:[~〜～ー–—-]|から)\s*(\d{2,3})\s*万/.exec(t);
  if (monthRangeMan) {
    out.salaryMin = Number(monthRangeMan[1]) * 10_000;
    out.salaryMax = Number(monthRangeMan[2]) * 10_000;
    out.salaryUnit = 'MONTH';
    out.salarySource = 'html:月給レンジ(万円)';
    return out;
  }
  const monthRangeYen = /月[給額収][^0-9]{0,14}(\d{3},\d{3}|\d{6})\s*円[^0-9]{0,8}(?:[~〜～ー–—-]|から)\s*(\d{3},\d{3}|\d{6})\s*円/.exec(t);
  if (monthRangeYen) {
    out.salaryMin = Number(monthRangeYen[1].replace(/,/g, ''));
    out.salaryMax = Number(monthRangeYen[2].replace(/,/g, ''));
    out.salaryUnit = 'MONTH';
    out.salarySource = 'html:月給レンジ(円)';
    return out;
  }
  const monthSingle = /月[給額収][^0-9]{0,14}(\d{3},\d{3}|\d{6})\s*円/.exec(t);
  if (monthSingle) {
    out.salaryMin = Number(monthSingle[1].replace(/,/g, ''));
    out.salaryUnit = 'MONTH';
    out.salarySource = 'html:月給下限のみ';
    return out;
  }
  const monthSingleMan = /月[給額収][^0-9]{0,14}(\d{2,3})\s*万/.exec(t);
  if (monthSingleMan) {
    out.salaryMin = Number(monthSingleMan[1]) * 10_000;
    out.salaryUnit = 'MONTH';
    out.salarySource = 'html:月給下限のみ(万円)';
    return out;
  }
  return out;
}

/** Minimum years of experience, only when the page states it in words. */
export function extractExperienceYears(text) {
  const t = norm(text);
  const a = /(?:実務)?経験[^。0-9]{0,8}(\d{1,2})\s*年\s*以上/.exec(t);
  if (a) return Number(a[1]);
  const b = /(\d{1,2})\s*年\s*以上[^。]{0,12}(?:実務)?経験/.exec(t);
  if (b) return Number(b[1]);
  return null;
}

export function extractEmploymentType(text) {
  const t = norm(text);
  const hits = EMPLOYMENT_TYPES.filter((w) => w !== '試用期間' && t.includes(w));
  return hits.length ? [...new Set(hits)].join(' | ') : null;
}

/** Work location, only when a location label is present on the page. */
export function extractLocation(text) {
  const t = norm(text);
  const label = /(勤務地|勤務場所|就業場所|勤務先|配属先|所在地)[^0-9一-龥ぁ-んァ-ン]{0,6}([\s\S]{0,120})/.exec(t);
  const scope = label ? label[2] : null;
  if (!scope) return null;
  const full = PREFECTURES_FULL.filter((p) => scope.includes(p));
  if (full.length) return [...new Set(full)].join(' | ').slice(0, 120);
  // Only now consider suffix-less wording such as "勤務地：東京／大阪".
  const bare = ['北海道', '東京', '京都', '大阪', ...PREFECTURE_BASES].filter((p) => scope.includes(p));
  if (bare.length) {
    const normalised = [...new Set(bare)].map((p) => (
      p === '東京' ? '東京都' : p === '京都' || p === '大阪' ? `${p}府` : p === '北海道' ? p : `${p}県`
    ));
    return [...new Set(normalised)].join(' | ').slice(0, 120);
  }
  const cleaned = scope.replace(/[|｜:：]/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 120) : null;
}

/** Short excerpt after a requirements heading. Never the whole body. */
export function extractRequirementExcerpt(text, labels) {
  const t = norm(text);
  for (const label of labels) {
    const i = t.indexOf(label);
    if (i === -1) continue;
    const after = t.slice(i + label.length).replace(/^[\s:：|｜・>】\]]+/, '');
    let window = after.slice(0, REQUIREMENT_EXCERPT_CHARS);
    // Stop before the next section so the value stays a field, not page text.
    const stop = EXCERPT_STOP.exec(window);
    if (stop && stop.index >= 8) window = window.slice(0, stop.index);
    const excerpt = window.trim().replace(/[\s|｜・:：]+$/, '');
    if (excerpt.length >= 6) return `${label}: ${excerpt}`;
  }
  return null;
}

export function cleanJobTitle(raw, company) {
  if (!raw) return null;
  let t = norm(raw).trim();
  if (company) {
    for (const part of [company, company.replace(/^(株式会社|有限会社|合同会社)/, ''), company.replace(/(株式会社|有限会社|合同会社)$/, '')]) {
      if (part && part.length > 2) t = t.split(part).join(' ').trim();
    }
  }
  t = t.replace(/^[|｜\-–—・\s]+|[|｜\-–—・\s]+$/g, '').trim();
  return t ? t.slice(0, 160) : null;
}

/**
 * A site-wide h1 such as "Recruit 採用情報" is not a job title. Prefer whichever
 * source actually names a role, and record which source was used.
 */
export function pickJobTitle({ headings = [], pageTitle = null, anchor = null, company = null }) {
  // Page furniture: true of every recruitment page, so it names no job.
  const GENERIC = /^(recruit(ing|ment)?|careers?|jobs?|entry|採用|採用情報|採用サイト|採用について|採用ページ|求人情報|募集要項|エントリー|recruit\s*採用情報|採用情報\s*recruit)$/i;
  const score = (v) => {
    if (JOB_TITLE_TOKENS.test(v)) return 2;
    if (GENERIC.test(v.replace(/[|｜\s]+/g, ' ').trim())) return 0;
    if (/(新卒採用|中途採用|キャリア採用|第二新卒|募集|職|コース|ポジション)/.test(v)) return 1;
    return 0;
  };
  const candidates = [
    ...headings.map((h) => ['h1h2', h]),
    ['anchor', anchor],
    ['pageTitle', pageTitle],
  ].map(([src, raw]) => [src, cleanJobTitle(raw, company)])
    .filter(([, v]) => v)
    .map(([src, v]) => ({ src, v, s: score(v) }));
  if (!candidates.length) return { jobTitle: null, jobTitleSource: null };
  const best = candidates.reduce((a, b) => (b.s > a.s ? b : a));
  return { jobTitle: best.v, jobTitleSource: best.src };
}

function htmlJobRecord(doc, html, company, anchor) {
  const title = extractTitle(html);
  const headings = extractHeadings(html, 3);
  const text = stripToVisibleText(html);
  const { flags } = matchFlags(`${text} ${title ?? ''}`);
  const salary = extractSalary(text);
  return {
    ...pickJobTitle({ headings, pageTitle: title, anchor, company }),
    jobUrl: doc.finalUrl,
    employmentType: extractEmploymentType(text),
    location: extractLocation(text),
    ...salary,
    experienceYearsMin: extractExperienceYears(text),
    requiredSkills: extractRequirementExcerpt(text, REQUIRED_LABELS),
    preferredSkills: extractRequirementExcerpt(text, PREFERRED_LABELS),
    flags,
    pageTitle: title,
    visibleChars: text.length,
    looksLikeJobDetail: looksLikeJobDetail(text, `${title ?? ''} ${headings.join(' ')} ${anchor ?? ''}`),
    source: 'html',
  };
}

/** Conservative: the page must carry job-posting furniture, not just the word 採用. */
export function looksLikeJobDetail(text, titleish = '') {
  const hasPostingFurniture = /(募集要項|応募資格|応募要件|仕事内容|業務内容|雇用形態|給与|待遇|募集職種)/.test(text);
  const hasConcreteField = /(募集要項|雇用形態|応募資格|応募要件|給与|月給|年収)/.test(text);
  return Boolean(hasPostingFurniture && (JOB_TITLE_TOKENS.test(titleish) || hasConcreteField));
}

/**
 * Keeps the dataset at one-record-per-JOB. A page whose own title says it is an
 * interview, an entry form or the recruitment top page is dropped unless it
 * names an actual role.
 */
export function isJobLevelRecord({ jobTitle, jobUrl }) {
  const title = (jobTitle ?? '').trim();
  if (!title) return false;
  if (JOB_TITLE_TOKENS.test(title)) return true;
  if (NOT_A_JOB_TITLE.test(title)) return false;
  if (GENERIC_JOB_TITLE.test(title)) return false;
  if (jobUrl && NOT_A_JOB_PATH.test(jobUrl)) return false;
  // 「新卒採用」「中途採用」のような募集区分名は職種ではないが求人枠として残す。
  return /(募集|採用|職|コース|ポジション|求人)/.test(title);
}

/**
 * `pageText` is only mixed in when the page carries a single posting; on a page
 * with several postings the body cannot be attributed to one of them, so flags
 * stay scoped to the posting's own fields. `flagScope` records which happened.
 */
function jsonLdJobRecord(posting, doc, company, pageText = null) {
  const hay = [posting.title, posting.skills, posting.qualifications, posting.experienceRequirements, posting.responsibilities]
    .filter(Boolean).join(' ');
  const scopeText = pageText ? `${hay} ${pageText}` : hay;
  const matched = scopeText.trim() ? matchFlags(scopeText).flags : null;
  return {
    flagScope: pageText ? 'posting+page' : (hay ? 'posting' : null),
    jobTitle: cleanJobTitle(posting.title, company),
    jobUrl: posting.url && /^https?:\/\//i.test(posting.url) ? posting.url : doc.finalUrl,
    employmentType: posting.employmentType,
    location: posting.jobLocation,
    salaryMin: posting.salaryMin,
    salaryMax: posting.salaryMax,
    salaryUnit: posting.salaryUnit,
    salarySource: posting.salaryMin !== null || posting.salaryMax !== null ? 'jsonld:baseSalary' : null,
    experienceYearsMin: posting.experienceRequirements ? extractExperienceYears(posting.experienceRequirements) : null,
    requiredSkills: posting.skills ?? posting.qualifications ?? null,
    preferredSkills: null,
    flags: matched ?? nullFlags(),
    pageTitle: null,
    visibleChars: null,
    looksLikeJobDetail: true,
    source: 'jsonld',
    datePosted: posting.datePosted ?? null,
    validThrough: posting.validThrough ?? null,
    occupationalCategory: posting.occupationalCategory ?? null,
  };
}

// ---------------------------------------------------------------------------
// per company
// ---------------------------------------------------------------------------

function jobLinkCandidates(anchors, baseUrl, homepageUrl) {
  const details = [];
  const indexes = [];
  const seen = new Set();
  const baseDomain = registrableDomain(hostOf(baseUrl));
  for (const a of anchors) {
    const key = a.url.replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const host = hostOf(a.url);
    const cat = classifyHost(a.url, homepageUrl);
    if (cat === 'jobPlatform') continue; // never followed
    const sameSite = registrableDomain(host) === baseDomain || isAts(host);
    if (!sameSite) continue;
    let u;
    try { u = new URL(a.url); } catch { continue; }
    const p = decodeURIComponent(u.pathname).toLowerCase();
    if (NOT_A_JOB_PATH.test(p)) continue;
    const label = norm(a.label);
    if (JOB_INDEX_WORDS.some((w) => label.toLowerCase().includes(w.toLowerCase()))) {
      indexes.push({ url: a.url, label: a.label });
      continue;
    }
    const titleish = JOB_TITLE_TOKENS.test(label);
    const detailPath = JOB_DETAIL_PATH.test(p) && u.pathname.split('/').filter(Boolean).length >= 2;
    const idLike = /\/(\d+|[a-z0-9_-]{2,40})\/?$/.test(p) && JOB_DETAIL_PATH.test(p);
    if (titleish && (detailPath || idLike || JOB_DETAIL_PATH.test(p))) {
      details.push({ url: a.url, label: a.label, score: 3 });
    } else if (detailPath && idLike) {
      details.push({ url: a.url, label: a.label, score: 1 });
    }
  }
  details.sort((a, b) => b.score - a.score);
  return { details, indexes };
}

async function jobsForCompany(company, opts) {
  const out = {
    corporateNumber: company.corporateNumber,
    company: company.company,
    prefecture: company.prefecture,
    companySize: company.companySize,
    stratum: company.stratum,
    populationWeight: company.populationWeight,
    homepageUrl: company.homepageUrl,
    recruitmentUrl: company.recruitmentUrl,
    recruitmentFinalUrl: company.finalUrl,
    confidence: company.confidence,
    hostCategory: company.hostCategory,
    recruitmentPageStatus: null,
    recruitmentPageRobots: null,
    jobIndexPagesFetched: 0,
    jobDetailPagesFetched: 0,
    jobLinkCandidates: 0,
    rejectedNonJobPages: 0,
    jobRecords: [],
    error: null,
  };

  const page = await fetchDocument(company.finalUrl ?? company.recruitmentUrl, opts);
  out.recruitmentPageStatus = page.httpStatus;
  out.recruitmentPageRobots = page.robotsStatus;
  if (!page.ok) {
    out.error = page.error;
    page.html = null;
    return out;
  }

  const records = [];
  const seenJobUrls = new Set();
  const pushRecord = (rec, doc) => {
    const key = (rec.jobUrl ?? '').replace(/\/$/, '') + '#' + (rec.jobTitle ?? '');
    if (seenJobUrls.has(key)) return;
    seenJobUrls.add(key);
    records.push({
      corporateNumber: out.corporateNumber,
      company: out.company,
      ...rec,
      httpStatus: doc.httpStatus,
      robotsStatus: doc.robotsStatus,
      hostCategory: classifyHost(rec.jobUrl ?? doc.finalUrl, company.homepageUrl),
      fetchedAt: doc.fetchedAt,
    });
  };

  const anchors = extractAnchors(page.html, page.finalUrl);
  const pageText = stripToVisibleText(page.html);
  const pageTitle = extractTitle(page.html);

  // 1. JobPosting JSON-LD on the recruitment page itself.
  const pageJp = extractJobPostings(extractJsonLdBlocks(page.html));
  const pageScopeText = pageJp.postings.length === 1 ? pageText : null;
  for (const p of pageJp.postings) pushRecord(jsonLdJobRecord(p, page, company.company, pageScopeText), page);

  // 2. Job links from the recruitment page (plus one optional index hop).
  page.html = null;

  let { details, indexes } = jobLinkCandidates(anchors, page.finalUrl, company.homepageUrl);
  for (const idx of indexes.slice(0, MAX_INDEX_HOPS)) {
    const doc = await fetchDocument(idx.url, opts);
    out.jobIndexPagesFetched += 1;
    if (!doc.ok) { doc.html = null; continue; }
    const idxJp = extractJobPostings(extractJsonLdBlocks(doc.html));
    for (const p of idxJp.postings) pushRecord(jsonLdJobRecord(p, doc, company.company), doc);
    const more = jobLinkCandidates(extractAnchors(doc.html, doc.finalUrl), doc.finalUrl, company.homepageUrl);
    doc.html = null;
    details = [...details, ...more.details];
  }

  // Deduplicate candidate URLs and drop the recruitment page itself.
  const basekey = (page.finalUrl ?? '').replace(/\/$/, '');
  const uniq = [];
  const seenCand = new Set([basekey]);
  for (const d of details) {
    const k = d.url.replace(/\/$/, '');
    if (seenCand.has(k)) continue;
    seenCand.add(k);
    uniq.push(d);
  }
  out.jobLinkCandidates = uniq.length;

  for (const cand of uniq.slice(0, MAX_JOBS_PER_COMPANY)) {
    const doc = await fetchDocument(cand.url, opts);
    out.jobDetailPagesFetched += 1;
    if (!doc.ok) { doc.html = null; continue; }
    const jp = extractJobPostings(extractJsonLdBlocks(doc.html));
    if (jp.postings.length) {
      const detailText = jp.postings.length === 1 ? stripToVisibleText(doc.html) : null;
      for (const p of jp.postings) pushRecord(jsonLdJobRecord(p, doc, company.company, detailText), doc);
    } else {
      const rec = htmlJobRecord(doc, doc.html, company.company, cand.label ?? null);
      rec.discoveryAnchor = cand.label ?? null;
      if (rec.looksLikeJobDetail && isJobLevelRecord(rec)) pushRecord(rec, doc);
      else out.rejectedNonJobPages += 1;
    }
    doc.html = null;
  }

  // 3. If nothing was reachable, the recruitment page itself may be the single
  //    posting. Only accepted when it clearly states 募集要項-style content.
  if (!records.length) {
    const self = {
      ...pickJobTitle({ headings: [], pageTitle, anchor: company.discoveryAnchor ?? null, company: company.company }),
      jobUrl: page.finalUrl,
      employmentType: extractEmploymentType(pageText),
      location: extractLocation(pageText),
      ...extractSalary(pageText),
      experienceYearsMin: extractExperienceYears(pageText),
      requiredSkills: extractRequirementExcerpt(pageText, REQUIRED_LABELS),
      preferredSkills: extractRequirementExcerpt(pageText, PREFERRED_LABELS),
      flags: matchFlags(`${pageText} ${pageTitle ?? ''}`).flags,
      pageTitle,
      visibleChars: pageText.length,
      looksLikeJobDetail: /(募集要項|応募資格|雇用形態)/.test(pageText) && /(給与|給料|月給|年収|待遇)/.test(pageText),
      source: 'html:recruitmentPageAsSinglePosting',
    };
    // The recruitment page itself may be the only posting; a generic title is
    // tolerated here because the page is known to carry 募集要項-style content.
    if (self.looksLikeJobDetail && !NOT_A_JOB_TITLE.test(self.jobTitle ?? '')) pushRecord(self, page);
  }

  out.jobRecords = records;
  return out;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { tag: '300', concurrency: 6, outTag: null, limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tag') out.tag = argv[++i];
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (a === '--out-tag') out.outTag = argv[++i];
    else if (a === '--limit') out.limit = Number(argv[++i]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = path.join(DIR, `${RUN_DATE}-discovery-${args.tag}.json`);
  if (!fs.existsSync(inPath)) throw new Error(`Missing stage 4 output: ${inPath}`);
  const discovery = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const tag = args.outTag ?? args.tag;
  const outJson = path.join(DIR, `${RUN_DATE}-jobs-${tag}.json`);
  const outCsv = path.join(DIR, `${RUN_DATE}-jobs-${tag}.csv`);

  let companies = discovery.results.filter((r) => (
    (r.confidence === 'high' || r.confidence === 'medium')
    && ['ownDomain', 'atsHosted'].includes(r.hostCategory)
    && r.verifiedAsRecruitmentPage === true
  ));
  if (args.limit) companies = companies.slice(0, args.limit);

  const opts = { ...DEFAULTS };
  const started = Date.now();
  let done = 0;
  const perCompany = await runPool(companies, args.concurrency, async (c) => {
    const r = await jobsForCompany(c, opts);
    done += 1;
    process.stderr.write(`[${done}/${companies.length}] jobs=${String(r.jobRecords.length).padStart(2)} fetched=${r.jobDetailPagesFetched} ${r.company}\n`);
    return r;
  });
  const elapsedSeconds = round((Date.now() - started) / 1000, 1);

  const allJobs = perCompany.flatMap((c) => c.jobRecords);
  const withJobs = perCompany.filter((c) => c.jobRecords.length > 0);
  const flagKeys = Object.keys(nullFlags());
  const nonNull = (key) => allJobs.filter((j) => j[key] !== null && j[key] !== undefined && j[key] !== '').length;
  const countBy = (arr, fn) => arr.reduce((a, r) => { const k = String(fn(r) ?? 'null'); a[k] = (a[k] ?? 0) + 1; return a; }, {});

  const payload = {
    runDate: RUN_DATE,
    stage: 'stage5-jobs',
    generator: 'scripts/research-jobs.mjs',
    generatedAtUtc: new Date(started).toISOString(),
    finishedAtUtc: new Date().toISOString(),
    elapsedSeconds,
    inputs: { discovery: inPath, discoveryTag: args.tag },
    settings: { userAgent: USER_AGENT, ...opts, concurrency: args.concurrency, maxJobsPerCompany: MAX_JOBS_PER_COMPANY, maxIndexHops: MAX_INDEX_HOPS, requirementExcerptChars: REQUIREMENT_EXCERPT_CHARS },
    counts: {
      companiesEligible: companies.length,
      companiesReachingJobRecords: withJobs.length,
      companyReachRate: round(rate(withJobs.length, companies.length)),
      jobRecords: allJobs.length,
      medianJobRecordsPerReachingCompany: median(withJobs.map((c) => c.jobRecords.length)),
      medianJobRecordsPerEligibleCompany: median(perCompany.map((c) => c.jobRecords.length)),
      maxJobRecordsForOneCompany: perCompany.reduce((a, c) => Math.max(a, c.jobRecords.length), 0),
      jobDetailPagesFetched: perCompany.reduce((a, c) => a + c.jobDetailPagesFetched, 0),
      jobIndexPagesFetched: perCompany.reduce((a, c) => a + c.jobIndexPagesFetched, 0),
      recruitmentPageFetchFailures: perCompany.filter((c) => c.error).length,
      rejectedNonJobPages: perCompany.reduce((a, c) => a + (c.rejectedNonJobPages ?? 0), 0),
      roleNamedJobRecords: allJobs.filter((j) => JOB_TITLE_TOKENS.test(j.jobTitle ?? '')).length,
      jobRecordsFromJsonLd: allJobs.filter((j) => j.source === 'jsonld').length,
      jobRecordsFromHtmlDetail: allJobs.filter((j) => j.source === 'html').length,
      jobRecordsFromRecruitmentPageItself: allJobs.filter((j) => j.source === 'html:recruitmentPageAsSinglePosting').length,
    },
    accessOutcomes: {
      recruitmentPageStatusCounts: countBy(perCompany, (c) => c.recruitmentPageStatus),
      recruitmentPageErrorCounts: countBy(perCompany.filter((c) => c.error), (c) => c.error),
      robotsStatusCounts: countBy(perCompany, (c) => c.recruitmentPageRobots),
    },
    fieldCoverageAmongJobRecords: {
      denominator: allJobs.length,
      jobTitle: nonNull('jobTitle'),
      employmentType: nonNull('employmentType'),
      location: nonNull('location'),
      salaryMin: allJobs.filter((j) => j.salaryMin !== null).length,
      salaryMax: allJobs.filter((j) => j.salaryMax !== null).length,
      experienceYearsMin: allJobs.filter((j) => j.experienceYearsMin !== null).length,
      requiredSkills: nonNull('requiredSkills'),
      preferredSkills: nonNull('preferredSkills'),
      salaryUnitCounts: countBy(allJobs.filter((j) => j.salaryUnit), (j) => j.salaryUnit),
      salarySourceCounts: countBy(allJobs.filter((j) => j.salarySource), (j) => j.salarySource),
    },
    flagCountsAmongJobRecords: Object.fromEntries(flagKeys.map((k) => {
      const known = allJobs.filter((j) => typeof j.flags?.[k] === 'boolean');
      const yes = known.filter((j) => j.flags[k] === true).length;
      return [k, { denominator: known.length, count: yes, rate: round(rate(yes, known.length)) }];
    })),
    methodNotes: [
      'JobPosting JSON-LD を優先し、HTMLは補完として使用。HTML由来の値は「ページに明記されていた場合のみ」埋め、推測はしない。',
      '求人本文全文は保存していない。requiredSkills / preferredSkills は見出し直後の160文字以内の抜粋。',
      '1求人=1レコード。JSON-LDが複数求人を持つページはその数だけレコードになる。',
      '1社あたり求人詳細の取得は最大8件、求人一覧への遷移は1階層まで。第三者求人媒体は辿らない。',
      'salaryUnit が MONTH のレコードを YEAR と混ぜて平均してはいけない。',
      'confidence low の企業は対象外。',
      '不明値は null。0 や false で埋めていない。',
    ],
    companies: perCompany.map(({ jobRecords, ...rest }) => ({ ...rest, jobRecordCount: jobRecords.length })),
    jobs: allJobs,
  };

  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  writeCsv(outCsv, [
    'corporateNumber', 'company', 'jobTitle', 'jobUrl', 'employmentType', 'location',
    'salaryMin', 'salaryMax', 'salaryUnit', 'salarySource',
    'secondNewGrad', 'inexperienced', 'recentGraduate', 'potentialHire',
    'experienceYearsMin', 'practicalExperience', 'training', 'remote', 'fullRemote', 'portfolio',
    'requiredSkills', 'preferredSkills', 'fetchedAt',
    'source', 'httpStatus', 'robotsStatus', 'hostCategory', 'looksLikeJobDetail', 'pageTitle',
  ], allJobs.map((j) => ({ ...j, ...(j.flags ?? {}) })));

  console.log(JSON.stringify({ out: [outJson, outCsv], elapsedSeconds, counts: payload.counts, coverage: payload.fieldCoverageAmongJobRecords }, null, 2));
}

// Only run as a CLI; the extractors above are imported by the unit tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`ERROR: ${e?.stack ?? e}`); process.exit(1); });
}
