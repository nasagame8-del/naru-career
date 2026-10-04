#!/usr/bin/env node
/**
 * NARU Research stage 5 (v2): break discovered recruitment pages down into
 * ONE RECORD PER JOB, with the record's type and the evidence for its title
 * stated explicitly.
 *
 * Input:  data/research/shokuba/<date>-discovery-<tag>.json (stage 4)
 * Output: <date>-jobs-<tag>.json / .csv        — the analysis set
 *         <date>-jobs-<tag>-excluded.json      — everything held out of counts
 *
 * recordType:
 *   job_detail  — a page about one role
 *   job_card    — one job entry on a listing
 *   job_section — one role's section inside a multi-role page
 *   category    — a hiring track (新卒採用 / 中途採用 / キャリア採用 …)
 *   container   — page furniture (Recruit / 採用情報 / 募集要項 / 求人一覧 …)
 *   unknown     — not classifiable
 * Only job_detail / job_card / job_section with jobTitleConfidence high or
 * medium enter the analysis set. Everything else goes to the excluded file and
 * is never counted as a job.
 *
 * Rules kept from v1:
 * - JobPosting JSON-LD is authoritative; HTML is a fallback/complement
 * - no job body is stored; requirement values are heading excerpts capped at
 *   160 characters
 * - unknown values stay null; nothing is inferred or defaulted to 0
 * - only links the site itself exposes are followed, depth 2 at most, and only
 *   within the company's own registrable domain or an official ATS
 * - third-party job media are never followed
 * - robots.txt, per-host serialisation and the response cap come from
 *   research-web.mjs and apply to every request
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  writeCsv, fetchDocument, extractAnchors, extractTitle, stripToVisibleText,
  extractJsonLdBlocks, extractJobPostings, extractBlocks, headingSections, rowsWithin,
  classifyHost, hostOf, registrableDomain, isAts, matchFlags, nullFlags, runPool, median, round, rate,
  DEFAULTS, USER_AGENT, getRequestStats, appendCheckpoint, readCheckpoint, atomicWriteFile,
} from './research-web.mjs';

const RUN_DATE = '2026-10-04';
const DIR = path.join('data', 'research', 'shokuba');

export const MAX_JOBS_PER_COMPANY = 20;
const MAX_INDEX_PAGES_PER_COMPANY = 3;
const MAX_DEPTH = 2;
const REQUIREMENT_EXCERPT_CHARS = 160;

// ---------------------------------------------------------------------------
// vocabularies
// ---------------------------------------------------------------------------

/** Page furniture. Never a job title on its own. */
export const CONTAINER_TITLES = [
  'recruit', 'recruiting', 'recruitment', 'career', 'careers', 'job', 'jobs', 'entry', 'entries',
  '採用', '採用情報', '採用案内', '採用について', '採用サイト', '採用ページ', '採用トップ', '採用メッセージ',
  '募集要項', '募集職種', '募集一覧', '職種一覧', '職種紹介', '求人情報', '求人一覧', '求人募集',
  'エントリー', 'エントリーフォーム', '応募フォーム', '募集', 'わたしたちについて', 'about',
  'recruit採用情報', '採用情報recruit', 'joinus', 'join us', 'work', 'works', 'people', 'member', 'members',
];

/** Hiring tracks. Real information, but a track is not a job. */
export const CATEGORY_TITLES = [
  '新卒採用', '新卒', '新卒者採用', '新卒採用情報', '中途採用', '中途', '中途採用情報',
  'キャリア採用', '経験者採用', '第二新卒採用', '通年採用', '障がい者採用', '障害者採用',
  'インターン', 'インターンシップ', 'アルバイト採用', 'パート採用', '契約社員採用',
  '新卒・中途採用', '新卒/中途採用', 'newgraduate', 'new graduate', 'midcareer', 'mid-career', 'career採用',
];

/** Tokens that make a string plausibly a role name. */
export const ROLE_TOKENS = /(エンジニア|プログラマ|プログラマー|システムエンジニア|\bSE\b|\bPG\b|ディレクター|デザイナー|マーケタ|マーケター|マーケティング|営業|セールス|コンサルタント|コンサル|プランナー|オペレーター|技術職|総合職|開発職|開発者|研究職|事務職|一般事務|営業事務|インフラ|ネットワーク|サーバ|データベース|データサイエン|アナリスト|\bPM\b|\bPMO\b|プロジェクトマネー|プロダクトマネー|ライター|編集者|企画職|広報|人事|経理|財務|法務|総務|サポートエンジニア|カスタマーサクセス|カスタマーサポート|ヘルプデスク|テスター|\bQA\b|品質保証|保守運用|運用保守|施工管理|技術営業|\bWeb\b制作|コーダー|フロントエンド|バックエンド|フルスタック|スマホアプリ|アプリ開発|機械学習|\bAI\b開発|セキュリティ)/i;

/** Field labels that prove a block is a posting rather than prose. */
const FIELD_PATTERNS = {
  jobTitleField: /(職種名|募集職種|職種|ポジション|募集ポジション)\s*[:：|｜]?\s*([^\n]{1,80})/,
  duties: /(仕事内容|業務内容|職務内容|担当業務|主な業務)/,
  salary: /(給与|給料|月給|年収|想定年収|初任給|報酬|月額基本給)/,
  location: /(勤務地|勤務場所|就業場所|勤務先|配属先)/,
  employment: /(雇用形態|契約形態|勤務形態)/,
  requirements: /(応募資格|応募要件|必須条件|必須スキル|必要なスキル|求める人材|求める経験|応募条件)/,
  workingHours: /(勤務時間|就業時間|始業|所定労働時間)/,
  holidays: /(休日|休暇|年間休日)/,
};

const EMPLOYMENT_TYPES = ['正社員', '契約社員', '業務委託', 'アルバイト', 'パート', '派遣社員', '嘱託', 'インターン', '時短勤務'];

const PREFECTURE_BASES = ['青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'];
/**
 * Full forms are matched first on purpose: "東京都渋谷区" contains the
 * substring "京都", so bare-name matching alone invents a second prefecture.
 */
const PREFECTURES_FULL = ['北海道', '東京都', '京都府', '大阪府', ...PREFECTURE_BASES.map((p) => `${p}県`)];

const REQUIRED_LABELS = ['必須スキル', '必須条件', '必須要件', '応募資格', '応募要件', '必要なスキル', '求める経験', '求める人材', '応募条件'];
const PREFERRED_LABELS = ['歓迎スキル', '歓迎条件', '歓迎要件', '歓迎する経験', 'あると望ましい', 'あれば歓迎', '尚可'];
const EXCERPT_STOP = /(歓迎スキル|歓迎条件|歓迎要件|給与|給料|月給|年収|待遇|福利厚生|勤務地|勤務先|勤務場所|勤務時間|雇用形態|選考|応募方法|お問い合わせ|CONTACT|エントリー|Tel|TEL|電話|©|&copy;)/;

/**
 * Headings under which a role-like link is a posting rather than navigation.
 * Outside these, a card needs posting fields of its own.
 */
const CARD_SECTION_TITLES = ['募集職種', '募集中の職種', '求人一覧', '職種一覧', '募集一覧', '募集要項', '募集中の求人', 'open positions', 'openings', 'positions'];

/** Anchor wording that leads to a job detail or a job index. */
const JOB_INDEX_ANCHORS = ['募集職種', '募集要項', '職種一覧', '求人一覧', '募集一覧', '職種紹介', '募集中の職種', '仕事を知る', '仕事紹介', 'job list', 'positions', 'openings', 'all jobs'];
const JOB_DETAIL_ANCHORS = ['職種詳細', '求人詳細', '詳細を見る', '詳しく見る', 'この職種', 'view more', 'read more', 'more', 'entry', 'エントリー', '応募する'];
const JOB_PATH_HINT = /(recruit|saiyo|saiyou|career|careers|jobs?|occupation|position|offer|entry|employment|shokushu|boshu|募集|求人|職種)/i;
const NOT_A_JOB_PATH = /(privacy|policy|contact|inquiry|news|blog|press|faq|sitemap|login|mypage|\/tag\/|\/tags\/|\/category\/|\/archives?\/|\/author\/|interview|crosstalk|zadankai|benefit|welfare|message|culture|environment|history|company|about|ir\/|\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?|pptx?)$)/i;

// ---------------------------------------------------------------------------
// title classification
// ---------------------------------------------------------------------------

export const norm = (s) => (s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();

/** Normalised key for comparison: case/width/space/punctuation insensitive. */
export function normaliseTitleKey(s) {
  return norm(s)
    .toLowerCase()
    .replace(/[【】\[\]（）()「」『』〈〉《》<>|｜/\\・,，.。:：;；!！?？"'`~～\-–—_＿*※#]/g, '')
    .replace(/\s+/g, '');
}

/**
 * container = page furniture, category = hiring track, role = plausible job
 * name, other = anything else (kept, but never promoted on its own).
 */
export function classifyTitle(raw) {
  const key = normaliseTitleKey(raw);
  if (!key) return 'empty';
  if (CONTAINER_TITLES.some((c) => normaliseTitleKey(c) === key)) return 'container';
  if (CATEGORY_TITLES.some((c) => normaliseTitleKey(c) === key)) return 'category';
  const text = norm(raw);
  // A sentence is a slogan, not a job title: 「エンジニアの将来像実現に、本気になる。」
  if (/[。！？!?]/.test(text) || text.length > 40) return 'other';
  // An employee profile is not a job: 「経理（2022年入社）M.I」「営業 I.S」
  if (/\d{4}\s*年入社/.test(text) || /\b[A-Z]\s*\.\s*[A-Z]\b/.test(text)) return 'other';
  if (ROLE_TOKENS.test(norm(raw))) return 'role';
  // 「新卒採用（技術職）」のように区分＋職種が結合している場合だけ職種扱い。
  // 「新卒採用 エントリー」のように残りがページ用語なら区分のまま。
  for (const c of CATEGORY_TITLES) {
    const ck = normaliseTitleKey(c);
    if (!key.startsWith(ck) || key.length <= ck.length) continue;
    const rest = key.slice(ck.length);
    if (CONTAINER_TITLES.some((x) => normaliseTitleKey(x) === rest)) return 'category';
    if (ROLE_TOKENS.test(rest) || /(職|コース|ポジション)$/.test(rest)) return 'role';
    return 'category';
  }
  if (/(職|コース|ポジション|スタッフ|要員)$/.test(norm(raw)) && norm(raw).length <= 30) return 'role';
  return 'other';
}

export function stripCompanyName(raw, company) {
  if (!raw) return null;
  let t = norm(raw);
  if (company) {
    const variants = [
      company,
      company.replace(/^(株式会社|有限会社|合同会社|合資会社|合名会社)/, ''),
      company.replace(/(株式会社|有限会社|合同会社|合資会社|合名会社)$/, ''),
      norm(company).normalize('NFKC'),
    ];
    for (const v of variants) {
      const n = norm(v);
      if (n && n.length > 2) t = t.split(n).join(' ').trim();
    }
  }
  // Drop a trailing/leading site-name segment such as "｜採用サイト".
  const parts = t.split(/[|｜–—]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    const meaningful = parts.filter((p) => classifyTitle(p) === 'role');
    if (meaningful.length) t = meaningful.join(' / ');
    else t = parts[0];
  }
  t = t.replace(/^[\s|｜\-–—・:：]+|[\s|｜\-–—・:：]+$/g, '').trim();
  return t || null;
}

// ---------------------------------------------------------------------------
// field extraction
// ---------------------------------------------------------------------------

export function fieldsPresent(text) {
  const t = norm(text);
  const present = {};
  for (const [name, re] of Object.entries(FIELD_PATTERNS)) {
    if (name === 'jobTitleField') continue;
    present[name] = re.test(t);
  }
  return present;
}

export function fieldScore(text) {
  const p = fieldsPresent(text);
  return ['duties', 'salary', 'location', 'employment', 'requirements', 'workingHours', 'holidays']
    .filter((k) => p[k]).length;
}

/** Annual/monthly pay stated explicitly. Returns nulls otherwise. */
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
  const hits = EMPLOYMENT_TYPES.filter((w) => t.includes(w));
  return hits.length ? [...new Set(hits)].join(' | ') : null;
}

/** Work location, only when a location label is present. */
export function extractLocation(text) {
  const t = norm(text);
  const label = /(勤務地|勤務場所|就業場所|勤務先|配属先|所在地)[^0-9一-龥ぁ-んァ-ン]{0,6}([\s\S]{0,120})/.exec(t);
  const scope = label ? label[2] : null;
  if (!scope) return null;
  const full = PREFECTURES_FULL.filter((p) => scope.includes(p));
  if (full.length) return [...new Set(full)].join(' | ').slice(0, 120);
  const bare = ['北海道', '東京', '京都', '大阪', ...PREFECTURE_BASES].filter((p) => scope.includes(p));
  if (bare.length) {
    const normalised = [...new Set(bare)].map((p) => (
      p === '東京' ? '東京都' : p === '京都' || p === '大阪' ? `${p}府` : p === '北海道' ? p : `${p}県`
    ));
    return [...new Set(normalised)].join(' | ').slice(0, 120);
  }
  // No prefecture named. Accept a short place-like fragment only, and stop at
  // the next field label so the value never swallows the rest of the table.
  let fragment = scope.replace(/[|｜:：]/g, ' ').trim();
  const nextLabel = /(就業時間|勤務時間|休日|休暇|賃金|給与|給料|賞与|昇給|福利|保険|雇用形態|応募|選考|備考|その他|連絡先|試用期間|諸手当)/.exec(fragment);
  if (nextLabel && nextLabel.index > 0) fragment = fragment.slice(0, nextLabel.index).trim();
  fragment = fragment.replace(/\s+/g, ' ').slice(0, 60).trim();
  if (!fragment) return null;
  return /[市区町村郡]/.test(fragment) || /〒|\d{3}-\d{4}/.test(fragment) ? fragment : null;
}

export function extractRequirementExcerpt(text, labels) {
  const t = norm(text);
  for (const label of labels) {
    const i = t.indexOf(label);
    if (i === -1) continue;
    const after = t.slice(i + label.length).replace(/^[\s:：|｜・>】\]]+/, '');
    let window = after.slice(0, REQUIREMENT_EXCERPT_CHARS);
    const stop = EXCERPT_STOP.exec(window);
    if (stop && stop.index >= 8) window = window.slice(0, stop.index);
    const excerpt = window.trim().replace(/[\s|｜・:：]+$/, '');
    if (excerpt.length >= 6) return `${label}: ${excerpt}`;
  }
  return null;
}

/**
 * Looks up a 職種-style label among table/dl rows. Internal spaces are
 * stripped because real pages write 「職 種」 for visual alignment.
 */
export function roleFromRows(rows) {
  for (const r of rows ?? []) {
    const label = norm(r.label).replace(/[\s:：]/g, '');
    if (!/^(職種名?|募集職種|職種業務内容|ポジション|募集ポジション|募集コース|募集対象職種|採用職種|募集区分)$/.test(label)) continue;
    const value = norm(r.value ?? '');
    if (value && value.length <= 200) return value;
  }
  return null;
}

/**
 * Some 募集要項 tables use the ROLE ITSELF as the row label and the duties as
 * the value (「営業 | IT営業・技術営業」). Those rows are jobs too.
 */
/** Row labels that are conditions, not roles: 「人事制度」「給与体系」… */
const CONDITION_LABEL = /(制度|体系|手当|規定|規程|保険|休暇|休日|時間|場所|勤務地|給与|給料|賃金|賞与|昇給|福利|厚生|選考|流れ|方法|資格|条件|人数|期間|備考|その他|連絡先|応募)$/;

export function rolesFromRowLabels(rows) {
  const out = [];
  for (const r of rows ?? []) {
    const label = norm(r.label).replace(/[:：]$/, '');
    if (!label || label.length > 60) continue;
    if (CONDITION_LABEL.test(label)) continue;
    if (classifyTitle(label) !== 'role') continue;
    const value = norm(r.value ?? '');
    if (!value || value.length < 4) continue;
    out.push({ title: label, text: `${label} ${value}` });
  }
  // Deduplicate repeated labels while keeping the longest value.
  const map = new Map();
  for (const o of out) {
    const k = normaliseTitleKey(o.title);
    if (!map.has(k) || map.get(k).text.length < o.text.length) map.set(k, o);
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// record assembly
// ---------------------------------------------------------------------------

function baseFields(text) {
  return {
    employmentType: extractEmploymentType(text),
    location: extractLocation(text),
    ...extractSalary(text),
    experienceYearsMin: extractExperienceYears(text),
    requiredSkills: extractRequirementExcerpt(text, REQUIRED_LABELS),
    preferredSkills: extractRequirementExcerpt(text, PREFERRED_LABELS),
  };
}

/**
 * Title confidence. `high` needs machine-readable or unambiguous evidence;
 * `low` never enters the analysis set.
 */
export function titleConfidence({ evidence, titleClass, fields }) {
  if (evidence === 'jsonld.title') return 'high';
  if (evidence === 'field:職種' && titleClass !== 'container') return titleClass === 'role' ? 'high' : 'medium';
  if (titleClass === 'container' || titleClass === 'category' || titleClass === 'empty') return 'low';
  // A role-named link sitting under a 募集職種 / 求人一覧 heading is a posting
  // even when its conditions live on the linked page.
  if (evidence === 'card.listing' && titleClass === 'role') return 'medium';
  if (titleClass === 'role' && fields >= 2) return 'high';
  if (titleClass === 'role' && fields >= 1) return 'medium';
  if (evidence === 'card.title' && fields >= 1) return 'medium';
  return 'low';
}

function makeRecord({
  company, corporateNumber, jobUrl, jobTitle, evidence, titleClass, recordType, text, doc, extra = {},
}) {
  const fields = fieldScore(text);
  const confidence = titleConfidence({ evidence, titleClass, fields });
  const { flags } = matchFlags(text);
  return {
    corporateNumber,
    company,
    jobTitle,
    normalizedJobTitle: jobTitle ? normaliseTitleKey(jobTitle) : null,
    jobUrl,
    recordType,
    jobTitleEvidence: evidence,
    jobTitleConfidence: confidence,
    titleClass,
    fieldScore: fields,
    fieldsPresent: fieldsPresent(text),
    ...baseFields(text),
    flags,
    httpStatus: doc?.httpStatus ?? null,
    robotsStatus: doc?.robotsStatus ?? null,
    fetchedAt: doc?.fetchedAt ?? null,
    ...extra,
  };
}

function jsonLdRecord(posting, doc, company, corporateNumber, pageText) {
  const title = stripCompanyName(posting.title, company);
  const hay = [posting.title, posting.skills, posting.qualifications, posting.experienceRequirements, posting.responsibilities]
    .filter(Boolean).join(' ');
  const scopeText = pageText ? `${hay} ${pageText}` : hay;
  const { flags } = scopeText.trim() ? matchFlags(scopeText) : { flags: nullFlags() };
  return {
    corporateNumber,
    company,
    jobTitle: title,
    normalizedJobTitle: title ? normaliseTitleKey(title) : null,
    jobUrl: posting.url && /^https?:\/\//i.test(posting.url) ? posting.url : doc.finalUrl,
    recordType: 'job_detail',
    jobTitleEvidence: 'jsonld.title',
    jobTitleConfidence: title ? 'high' : 'low',
    titleClass: title ? classifyTitle(title) : 'empty',
    fieldScore: fieldScore(scopeText),
    fieldsPresent: fieldsPresent(scopeText),
    employmentType: posting.employmentType,
    location: posting.jobLocation,
    salaryMin: posting.salaryMin,
    salaryMax: posting.salaryMax,
    salaryUnit: posting.salaryUnit,
    salarySource: posting.salaryMin !== null || posting.salaryMax !== null ? 'jsonld:baseSalary' : null,
    experienceYearsMin: posting.experienceRequirements ? extractExperienceYears(posting.experienceRequirements) : null,
    requiredSkills: posting.skills ?? posting.qualifications ?? null,
    preferredSkills: null,
    flags,
    httpStatus: doc.httpStatus,
    robotsStatus: doc.robotsStatus,
    fetchedAt: doc.fetchedAt,
    flagScope: pageText ? 'posting+page' : 'posting',
    datePosted: posting.datePosted ?? null,
    validThrough: posting.validThrough ?? null,
  };
}

/**
 * Turns one fetched page into job candidates. This is the core of v2: a page is
 * decomposed into heading sections, tables/dls and cards, so a single page
 * listing several roles yields several records, while a page that only says
 * 「中途採用 / 募集要項」 yields a category or container record instead.
 */
export function extractCandidatesFromPage({ html, doc, company, corporateNumber, isIndexPage = false }) {
  const candidates = [];
  const pageTitleRaw = extractTitle(html);
  const blocks = extractBlocks(html);
  const pageText = stripToVisibleText(blocks.masked);
  const jsonLd = extractJobPostings(extractJsonLdBlocks(html));

  // 1. JobPosting JSON-LD wins outright.
  if (jsonLd.postings.length) {
    const scope = jsonLd.postings.length === 1 ? pageText : null;
    for (const p of jsonLd.postings) {
      candidates.push(jsonLdRecord(p, doc, company, corporateNumber, scope));
    }
    return { candidates, pageTitle: pageTitleRaw, pageText, blocks, jsonLdCount: jsonLd.postings.length };
  }

  const sections = headingSections(blocks);
  const pageRows = rowsWithin(blocks, 0, blocks.masked.length);
  const pageFieldScore = fieldScore(pageText);

  // 2. Per-heading sections, innermost first. A table that an inner section
  //    already turned into a job must not be counted again by its ancestors,
  //    otherwise one 募集要項 table becomes three identical records.
  const consumed = [];
  const usedBlocks = new Set();
  const blocksWithin = (start, end) => [...blocks.tables, ...blocks.defLists].filter((b) => b.start >= start && b.start < end);
  const ordered = [...sections].sort((a, b) => b.level - a.level || a.start - b.start);
  for (const s of ordered) {
    if (s.level > 4) continue;
    const titleClass = classifyTitle(s.heading);
    const ownBlocks = blocksWithin(s.start, s.end).filter((b) => !usedBlocks.has(b.start));
    const sectionRows = ownBlocks.flatMap((b) => b.rows.map((r) => ({ ...r, kind: b.kind, blockStart: b.start })));
    const roleFromField = roleFromRows(sectionRows);
    const sFields = fieldScore(s.text);
    const markUsed = () => { for (const b of ownBlocks) usedBlocks.add(b.start); };

    if (roleFromField && classifyTitle(roleFromField) !== 'container') {
      const title = stripCompanyName(roleFromField, company);
      candidates.push(makeRecord({
        company, corporateNumber, jobUrl: doc.finalUrl, jobTitle: title,
        evidence: 'field:職種', titleClass: classifyTitle(roleFromField),
        recordType: 'job_section', text: s.text, doc,
        extra: { sectionHeading: s.heading, sectionLevel: s.level },
      }));
      markUsed();
      consumed.push(s);
      continue;
    }
    // 募集要項テーブルが「職種名＝行ラベル」形式のとき、行ごとに1求人。
    const labelRoles = rolesFromRowLabels(sectionRows);
    if (labelRoles.length >= 1 && sFields >= 1) {
      for (const lr of labelRoles) {
        candidates.push(makeRecord({
          company, corporateNumber, jobUrl: doc.finalUrl,
          jobTitle: stripCompanyName(lr.title, company),
          evidence: 'field:職種', titleClass: 'role', recordType: 'job_section',
          text: `${lr.text} ${s.text}`, doc,
          extra: { sectionHeading: s.heading, sectionLevel: s.level, fromRowLabel: true },
        }));
      }
      markUsed();
      consumed.push(s);
      continue;
    }
    if (titleClass === 'role' && sFields >= 1) {
      const title = stripCompanyName(s.heading, company);
      candidates.push(makeRecord({
        company, corporateNumber, jobUrl: doc.finalUrl, jobTitle: title,
        evidence: 'section.heading', titleClass, recordType: 'job_section',
        text: s.text, doc, extra: { sectionHeading: s.heading, sectionLevel: s.level },
      }));
      markUsed();
      consumed.push(s);
      continue;
    }
    if (titleClass === 'category' && sFields >= 1) {
      // A hiring track with posting fields but no role heading inside it.
      const hasRoleChild = s.childHeadings.some((c) => classifyTitle(c.text) === 'role');
      if (!hasRoleChild) {
        candidates.push(makeRecord({
          company, corporateNumber, jobUrl: doc.finalUrl, jobTitle: norm(s.heading),
          evidence: 'section.heading', titleClass, recordType: 'category',
          text: s.text, doc, extra: { sectionHeading: s.heading, sectionLevel: s.level },
        }));
      }
    }
  }

  // A single role section anchored at the top of the page means the page is
  // about that one job, so it is a detail page rather than a section of a list.
  const sectionJobs = candidates.filter((c) => c.recordType === 'job_section');
  if (sectionJobs.length === 1 && (sectionJobs[0].sectionLevel ?? 9) <= 2) {
    sectionJobs[0].recordType = 'job_detail';
  }

  // 3. Page-level record when the page itself is one posting and no section
  //    already covered it.
  if (!consumed.length) {
    const h1 = blocks.headings.find((h) => h.level === 1);
    const h2 = blocks.headings.find((h) => h.level === 2);
    const roleFromPageRows = roleFromRows(pageRows);
    let title = null;
    let evidence = null;
    let titleClass = 'empty';

    if (roleFromPageRows && classifyTitle(roleFromPageRows) !== 'container') {
      title = stripCompanyName(roleFromPageRows, company);
      evidence = 'field:職種';
      titleClass = classifyTitle(roleFromPageRows);
    } else {
      for (const [h, ev] of [[h1, 'detail.h1'], [h2, 'detail.h2']]) {
        if (!h) continue;
        const c = classifyTitle(h.text);
        if (c === 'role') { title = stripCompanyName(h.text, company); evidence = ev; titleClass = c; break; }
      }
      if (!title) {
        const fromPageTitle = stripCompanyName(pageTitleRaw, company);
        if (fromPageTitle && classifyTitle(fromPageTitle) === 'role') {
          title = fromPageTitle; evidence = 'page.title'; titleClass = 'role';
        }
      }
    }

    if (title && pageFieldScore >= 1) {
      candidates.push(makeRecord({
        company, corporateNumber, jobUrl: doc.finalUrl, jobTitle: title,
        evidence, titleClass, recordType: 'job_detail', text: pageText, doc,
      }));
    } else {
      // Nothing role-like: record what the page actually is, so it can be
      // audited, and keep it out of the job counts.
      const headingText = h1?.text ?? h2?.text ?? pageTitleRaw ?? null;
      const hClass = headingText ? classifyTitle(stripCompanyName(headingText, company) ?? headingText) : 'empty';
      const recordType = hClass === 'container' ? 'container' : hClass === 'category' ? 'category' : 'unknown';
      candidates.push(makeRecord({
        company, corporateNumber, jobUrl: doc.finalUrl,
        jobTitle: headingText ? norm(headingText) : null,
        evidence: headingText ? 'detail.h1' : null, titleClass: hClass,
        recordType, text: pageText, doc,
      }));
    }
  }

  // 4. Job cards: a role-like link that the page itself presents as a posting.
  //    Either it sits under a 募集職種 / 求人一覧 style heading, or it carries
  //    posting fields in its immediate neighbourhood. A link under a generic
  //    heading with no fields is navigation, not a job.
  const cardSections = sections.filter((s) => CARD_SECTION_TITLES.some((c) => normaliseTitleKey(c) === normaliseTitleKey(s.heading)));
  const inCardSection = (pos) => cardSections.some((s) => pos >= s.start && pos < s.end);
  const seenCards = new Set();
  for (const a of blocks.anchors) {
    const label = norm(a.text);
    if (!label || classifyTitle(label) !== 'role') continue;
    const context = stripToVisibleText(blocks.masked.slice(Math.max(0, a.start - 600), a.end + 900));
    // 「システムエンジニア Y.K」「営業（2022年入社）」は社員インタビューの
    // リンクであって求人ではない。
    if (/([A-Z]\s*\.\s*[A-Z])|(\d{4}\s*年入社)|(社員|先輩|インタビュー|クロストーク|座談会)/.test(label)) continue;
    const listed = inCardSection(a.start);
    if (!listed && !(isIndexPage && fieldScore(context) >= 1)) continue;
    let abs;
    try { abs = new URL(a.href, doc.finalUrl).toString(); } catch { continue; }
    if (abs.replace(/\/$/, '') === (doc.finalUrl ?? '').replace(/\/$/, '')) continue;
    try {
      if (NOT_A_JOB_PATH.test(decodeURIComponent(new URL(abs).pathname).toLowerCase())) continue;
    } catch { continue; }
    const key = `${abs.replace(/\/$/, '')}#${normaliseTitleKey(label)}`;
    if (seenCards.has(key)) continue;
    seenCards.add(key);
    candidates.push(makeRecord({
      company, corporateNumber, jobUrl: abs, jobTitle: stripCompanyName(label, company),
      evidence: listed ? 'card.listing' : 'card.title', titleClass: 'role', recordType: 'job_card',
      text: listed ? `${label} ${context}` : context, doc,
      extra: { cardOnPage: doc.finalUrl, cardUnderListingHeading: listed },
    }));
  }

  // Two records with the same URL and the same normalised title differ in no
  // stored field, so they are one record. Keep the richest one.
  const RANK = { job_detail: 3, job_section: 2, job_card: 1 };
  const collapsed = [];
  const byKey = new Map();
  for (const c of candidates) {
    if (!ANALYSIS_RECORD_TYPES.has(c.recordType)) { collapsed.push(c); continue; }
    const key = `${(c.jobUrl ?? '').replace(/\/$/, '')}#${c.normalizedJobTitle ?? ''}`;
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, c); collapsed.push(c); continue; }
    const better = (RANK[c.recordType] ?? 0) > (RANK[prev.recordType] ?? 0)
      || ((RANK[c.recordType] ?? 0) === (RANK[prev.recordType] ?? 0) && (c.fieldScore ?? 0) > (prev.fieldScore ?? 0));
    if (better) {
      byKey.set(key, c);
      collapsed[collapsed.indexOf(prev)] = c;
    }
  }

  return { candidates: collapsed, pageTitle: pageTitleRaw, pageText, blocks, jsonLdCount: 0 };
}

// ---------------------------------------------------------------------------
// link discovery (depth <= 2, candidate URLs only)
// ---------------------------------------------------------------------------

function anchorKind(label) {
  const t = norm(label).toLowerCase();
  if (!t) return null;
  if (JOB_INDEX_ANCHORS.some((w) => t.includes(w.toLowerCase()))) return 'index';
  if (ROLE_TOKENS.test(norm(label))) return 'detail';
  if (JOB_DETAIL_ANCHORS.some((w) => t === w.toLowerCase() || t.includes(w.toLowerCase()))) return 'detail';
  return null;
}

export function jobLinkCandidates(anchors, baseUrl, homepageUrl) {
  const baseDomain = registrableDomain(hostOf(baseUrl));
  const details = [];
  const indexes = [];
  const seen = new Set();
  for (const a of anchors) {
    let u;
    try { u = new URL(a.url ?? a.href, baseUrl); } catch { continue; }
    u.hash = '';
    const url = u.toString();
    const key = url.replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const host = hostOf(url);
    if (classifyHost(url, homepageUrl) === 'jobPlatform') continue;
    const sameSite = registrableDomain(host) === baseDomain || isAts(host);
    if (!sameSite) continue;
    const p = decodeURIComponent(u.pathname).toLowerCase();
    if (NOT_A_JOB_PATH.test(p)) continue;
    const kind = anchorKind(a.label ?? a.text ?? '');
    const pathLooksJob = JOB_PATH_HINT.test(p);
    if (kind === 'index') { indexes.push({ url, label: a.label ?? a.text ?? null }); continue; }
    if (kind === 'detail' && pathLooksJob) { details.push({ url, label: a.label ?? a.text ?? null, score: 3 }); continue; }
    if (kind === 'detail') { details.push({ url, label: a.label ?? a.text ?? null, score: 2 }); continue; }
    // Unlabelled links are followed only when the path itself is job-shaped
    // and deep enough to be a specific posting. No URL is invented.
    if (pathLooksJob && u.pathname.split('/').filter(Boolean).length >= 2) {
      details.push({ url, label: a.label ?? a.text ?? null, score: 1 });
    }
  }
  details.sort((a, b) => b.score - a.score);
  return { details, indexes };
}

// ---------------------------------------------------------------------------
// per company
// ---------------------------------------------------------------------------

async function jobsForCompany(companyRow, opts) {
  const out = {
    corporateNumber: companyRow.corporateNumber,
    company: companyRow.company,
    prefecture: companyRow.prefecture,
    companySize: companyRow.companySize,
    stratum: companyRow.stratum,
    populationWeight: companyRow.populationWeight,
    homepageUrl: companyRow.homepageUrl,
    recruitmentUrl: companyRow.recruitmentUrl,
    recruitmentFinalUrl: companyRow.finalUrl,
    confidence: companyRow.confidence,
    hostCategory: companyRow.hostCategory,
    recruitmentPageStatus: null,
    recruitmentPageRobots: null,
    pagesFetched: 0,
    indexPagesFetched: 0,
    detailPagesFetched: 0,
    detailLinkCandidates: 0,
    depthReached: 0,
    hitJobCap: false,
    truncated: false,
    candidates: [],
    error: null,
  };

  const start = companyRow.finalUrl ?? companyRow.recruitmentUrl;
  const page = await fetchDocument(start, opts);
  out.pagesFetched += 1;
  out.recruitmentPageStatus = page.httpStatus;
  out.recruitmentPageRobots = page.robotsStatus;
  if (!page.ok) {
    out.error = page.error;
    page.html = null;
    return out;
  }

  const fetched = new Set([(page.finalUrl ?? start).replace(/\/$/, '')]);
  const all = [];

  const rootAnchors = extractAnchors(page.html, page.finalUrl);
  const rootLinks = jobLinkCandidates(rootAnchors, page.finalUrl, companyRow.homepageUrl);
  out.detailLinkCandidates = rootLinks.details.length;

  const rootExtract = extractCandidatesFromPage({
    html: page.html, doc: page, company: out.company, corporateNumber: out.corporateNumber,
    isIndexPage: rootLinks.details.length > 0,
  });
  page.html = null;
  for (const c of rootExtract.candidates) all.push({ ...c, sourcePage: page.finalUrl, depth: 0 });

  // Depth 1: index pages linked from the recruitment page.
  let detailQueue = [...rootLinks.details];
  for (const idx of rootLinks.indexes.slice(0, MAX_INDEX_PAGES_PER_COMPANY)) {
    const key = idx.url.replace(/\/$/, '');
    if (fetched.has(key)) continue;
    const doc = await fetchDocument(idx.url, opts);
    out.pagesFetched += 1;
    out.indexPagesFetched += 1;
    out.depthReached = Math.max(out.depthReached, 1);
    fetched.add(key);
    if (!doc.ok) { doc.html = null; continue; }
    const links = jobLinkCandidates(extractAnchors(doc.html, doc.finalUrl), doc.finalUrl, companyRow.homepageUrl);
    const ex = extractCandidatesFromPage({
      html: doc.html, doc, company: out.company, corporateNumber: out.corporateNumber,
      isIndexPage: links.details.length > 0,
    });
    doc.html = null;
    for (const c of ex.candidates) all.push({ ...c, sourcePage: doc.finalUrl, depth: 1 });
    detailQueue = [...detailQueue, ...links.details];
  }

  // Depth 2: the job detail pages themselves.
  const seenDetail = new Set();
  const queue = detailQueue.filter((d) => {
    const k = d.url.replace(/\/$/, '');
    if (fetched.has(k) || seenDetail.has(k)) return false;
    seenDetail.add(k);
    return true;
  });
  out.detailLinkCandidates = queue.length;
  for (const cand of queue) {
    if (out.detailPagesFetched >= MAX_JOBS_PER_COMPANY) { out.hitJobCap = true; out.truncated = true; break; }
    const doc = await fetchDocument(cand.url, opts);
    out.pagesFetched += 1;
    out.detailPagesFetched += 1;
    out.depthReached = Math.min(MAX_DEPTH, Math.max(out.depthReached, 2));
    if (!doc.ok) { doc.html = null; continue; }
    const ex = extractCandidatesFromPage({
      html: doc.html, doc, company: out.company, corporateNumber: out.corporateNumber, isIndexPage: false,
    });
    doc.html = null;
    for (const c of ex.candidates) {
      all.push({ ...c, sourcePage: doc.finalUrl, depth: 2, discoveryAnchor: cand.label ?? null });
    }
  }

  // Drop job_card records whose detail page we actually fetched: the detail
  // record is the better copy of the same job.
  const fetchedDetailUrls = new Set([...seenDetail].slice(0, out.detailPagesFetched));
  out.candidates = all.filter((c) => !(c.recordType === 'job_card' && fetchedDetailUrls.has((c.jobUrl ?? '').replace(/\/$/, ''))));
  return out;
}

// ---------------------------------------------------------------------------
// dedup
// ---------------------------------------------------------------------------

export function dedupKey(r) {
  return [
    r.corporateNumber ?? '',
    r.normalizedJobTitle ?? '',
    normaliseTitleKey(r.employmentType ?? ''),
    normaliseTitleKey(r.location ?? ''),
  ].join('|');
}

/** Marks duplicates with a shared group id. Nothing is merged or removed. */
export function assignDuplicateGroups(records) {
  const groups = new Map();
  for (const r of records) {
    const key = dedupKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const [key, list] of groups) {
    const id = `dup-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 10)}`;
    list.sort((a, b) => (a.jobUrl ?? '').localeCompare(b.jobUrl ?? ''));
    list.forEach((r, i) => {
      r.duplicateGroupId = id;
      r.duplicateGroupSize = list.length;
      r.duplicateRank = i + 1;
      r.isDuplicateOfEarlierRecord = list.length > 1 && i > 0;
      r.duplicateDistinctUrls = new Set(list.map((x) => x.jobUrl)).size;
    });
  }
  return records;
}

export const ANALYSIS_RECORD_TYPES = new Set(['job_detail', 'job_card', 'job_section']);

export function isAnalysisRecord(r) {
  return ANALYSIS_RECORD_TYPES.has(r.recordType)
    && (r.jobTitleConfidence === 'high' || r.jobTitleConfidence === 'medium')
    && Boolean(r.jobTitle);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { tag: '300', concurrency: 8, outTag: null, limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tag') out.tag = argv[++i];
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (a === '--out-tag') out.outTag = argv[++i];
    else if (a === '--limit') out.limit = Number(argv[++i]);
  }
  return out;
}

const countBy = (arr, fn) => {
  const m = new Map();
  for (const x of arr) { const k = String(fn(x) ?? 'null'); m.set(k, (m.get(k) ?? 0) + 1); }
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = path.join(DIR, `${RUN_DATE}-discovery-${args.tag}.json`);
  if (!fs.existsSync(inPath)) throw new Error(`Missing stage 4 output: ${inPath}`);
  const discovery = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const tag = args.outTag ?? args.tag;
  const outJson = path.join(DIR, `${RUN_DATE}-jobs-${tag}.json`);
  const outCsv = path.join(DIR, `${RUN_DATE}-jobs-${tag}.csv`);
  const outExcluded = path.join(DIR, `${RUN_DATE}-jobs-${tag}-excluded.json`);

  let companies = discovery.results.filter((r) => (
    (r.confidence === 'high' || r.confidence === 'medium')
    && ['ownDomain', 'atsHosted'].includes(r.hostCategory)
    && r.verifiedAsRecruitmentPage === true
  ));
  if (args.limit) companies = companies.slice(0, args.limit);

  const opts = { ...DEFAULTS };
  const started = Date.now();

  // Resume: a company already in the checkpoint is never re-crawled.
  const checkpointPath = path.join(DIR, 'checkpoints', `${RUN_DATE}-jobs-${tag}.jsonl`);
  const previous = readCheckpoint(checkpointPath);
  const doneByCorp = new Map();
  for (const r of previous) {
    if (r && r.corporateNumber) doneByCorp.set(r.corporateNumber, r);
  }
  const todo = companies.filter((c) => !doneByCorp.has(c.corporateNumber));
  if (doneByCorp.size) {
    process.stderr.write(`resuming: ${doneByCorp.size} companies already done, ${todo.length} remaining\n`);
  }

  let done = doneByCorp.size;
  const fresh = await runPool(todo, args.concurrency, async (c) => {
    const r = await jobsForCompany(c, opts);
    done += 1;
    appendCheckpoint(checkpointPath, r);
    const jobs = r.candidates.filter(isAnalysisRecord).length;
    process.stderr.write(`[${done}/${companies.length}] jobs=${String(jobs).padStart(2)} cand=${String(r.candidates.length).padStart(2)} pages=${r.pagesFetched} req=${getRequestStats().totalHttpRequests} ${r.company}\n`);
    return r;
  });
  const byCorp = new Map([...doneByCorp, ...fresh.map((r) => [r.corporateNumber, r])]);
  const perCompany = companies.map((c) => byCorp.get(c.corporateNumber)).filter(Boolean);
  const elapsedSeconds = round((Date.now() - started) / 1000, 1);

  const allCandidates = perCompany.flatMap((c) => c.candidates);
  assignDuplicateGroups(allCandidates);
  const jobs = allCandidates.filter(isAnalysisRecord);
  const excluded = allCandidates.filter((r) => !isAnalysisRecord(r));
  const byCompany = new Map();
  for (const j of jobs) {
    const k = j.corporateNumber ?? j.company;
    byCompany.set(k, (byCompany.get(k) ?? 0) + 1);
  }
  const reaching = [...byCompany.values()];
  const companiesWithNineOrMore = reaching.filter((n) => n >= 9).length;

  const flagKeys = Object.keys(nullFlags());
  const nonNull = (key) => jobs.filter((j) => j[key] !== null && j[key] !== undefined && j[key] !== '').length;
  const dupJobs = jobs.filter((j) => j.isDuplicateOfEarlierRecord).length;

  const payload = {
    runDate: RUN_DATE,
    stage: 'stage5-jobs-v2',
    provisional: true,
    provisionalReason: '1求人=1レコードの達成度が未完成のため、求人件数および求人単位の割合は暫定値。記事の確定数値として使用しないこと。Golden Set 50ページでの precision は 0.97 だが recall は 0.47 で、一覧ページ側の求人を取りこぼす。',
    generator: 'scripts/research-jobs.mjs',
    generatedAtUtc: new Date(started).toISOString(),
    finishedAtUtc: new Date().toISOString(),
    elapsedSeconds,
    inputs: { discovery: path.basename(inPath), discoveryTag: args.tag },
    settings: {
      userAgent: USER_AGENT,
      ...opts,
      concurrency: args.concurrency,
      maxJobsPerCompany: MAX_JOBS_PER_COMPANY,
      maxIndexPagesPerCompany: MAX_INDEX_PAGES_PER_COMPANY,
      maxDepth: MAX_DEPTH,
      requirementExcerptChars: REQUIREMENT_EXCERPT_CHARS,
    },
    counts: {
      companiesEligible: companies.length,
      candidateRecords: allCandidates.length,
      jobRecords: jobs.length,
      excludedRecords: excluded.length,
      recordTypeCounts: countBy(allCandidates, (r) => r.recordType),
      recordTypeCountsAmongJobs: countBy(jobs, (r) => r.recordType),
      titleConfidenceCounts: countBy(allCandidates, (r) => r.jobTitleConfidence),
      titleConfidenceCountsAmongJobs: countBy(jobs, (r) => r.jobTitleConfidence),
      titleEvidenceCountsAmongJobs: countBy(jobs, (r) => r.jobTitleEvidence),
      companiesReachingJobRecords: byCompany.size,
      companyReachRate: round(rate(byCompany.size, companies.length)),
      medianJobRecordsPerReachingCompany: median(reaching),
      meanJobRecordsPerReachingCompany: round(rate(jobs.length, byCompany.size), 2),
      companiesWithNineOrMoreJobRecords: companiesWithNineOrMore,
      companiesHittingTheFetchCap: perCompany.filter((c) => c.hitJobCap).length,
      companiesTruncatedAtCap: perCompany.filter((c) => c.truncated).length,
      truncationNote: `1社あたり求人詳細の取得上限は ${MAX_JOBS_PER_COMPANY} 件。truncated=true の企業は上限により求人が欠落している可能性がある。`,
      suspiciousJobTitles: jobs.filter((j) => ['container', 'category', 'other', 'empty'].includes(j.titleClass)).length,
      categoryOrContainerLikeRecords: allCandidates.filter((r) => ['category', 'container'].includes(r.recordType)).length,
      duplicateCandidateRecords: allCandidates.filter((r) => r.isDuplicateOfEarlierRecord).length,
      jobPostingJsonLdRecords: jobs.filter((j) => j.jobTitleEvidence === 'jsonld.title').length,
      maxJobRecordsForOneCompany: reaching.length ? Math.max(...reaching) : 0,
      pagesFetched: perCompany.reduce((a, c) => a + c.pagesFetched, 0),
      indexPagesFetched: perCompany.reduce((a, c) => a + c.indexPagesFetched, 0),
      detailPagesFetched: perCompany.reduce((a, c) => a + c.detailPagesFetched, 0),
      recruitmentPageFetchFailures: perCompany.filter((c) => c.error).length,
      duplicateJobRecords: dupJobs,
      duplicateRate: round(rate(dupJobs, jobs.length)),
      duplicateGroupsWithMoreThanOneUrl: new Set(jobs.filter((j) => j.duplicateGroupSize > 1).map((j) => j.duplicateGroupId)).size,
    },
    resume: {
      checkpoint: path.relative(process.cwd(), checkpointPath),
      companiesFromCheckpoint: doneByCorp.size,
      companiesCrawledThisRun: fresh.length,
    },
    httpAccounting: getRequestStats(),
    accessOutcomes: {
      recruitmentPageStatusCounts: countBy(perCompany, (c) => c.recruitmentPageStatus),
      recruitmentPageErrorCounts: countBy(perCompany.filter((c) => c.error), (c) => c.error),
      robotsStatusCounts: countBy(perCompany, (c) => c.recruitmentPageRobots),
    },
    fieldCoverageAmongJobRecords: {
      denominator: jobs.length,
      jobTitle: nonNull('jobTitle'),
      employmentType: nonNull('employmentType'),
      location: nonNull('location'),
      salaryMin: jobs.filter((j) => j.salaryMin !== null).length,
      salaryMax: jobs.filter((j) => j.salaryMax !== null).length,
      experienceYearsMin: jobs.filter((j) => j.experienceYearsMin !== null).length,
      requiredSkills: nonNull('requiredSkills'),
      preferredSkills: nonNull('preferredSkills'),
      salaryUnitCounts: countBy(jobs.filter((j) => j.salaryUnit), (j) => j.salaryUnit),
      salarySourceCounts: countBy(jobs.filter((j) => j.salarySource), (j) => j.salarySource),
    },
    flagCountsAmongJobRecords: Object.fromEntries(flagKeys.map((k) => {
      const known = jobs.filter((j) => typeof j.flags?.[k] === 'boolean');
      const yes = known.filter((j) => j.flags[k] === true).length;
      return [k, { denominator: known.length, count: yes, rate: round(rate(yes, known.length)) }];
    })),
    methodNotes: [
      'recordType が job_detail / job_card / job_section で、かつ jobTitleConfidence が high|medium のレコードのみ求人件数に数える。',
      'category（新卒採用・中途採用等の募集区分）と container（Recruit・採用情報・募集要項等）と unknown は別ファイルに分離し、求人件数に含めない。',
      '1ページに複数職種がある場合は見出し・table・dl 単位に分解して1求人=1レコードにする。',
      'JobPosting JSON-LD があればそれを優先し、HTMLは補完に使う。求人本文全文は保存しない。',
      '求人詳細の探索は深さ2まで。同一registrable domain と企業サイトから直リンクされた公式ATSのみ。無差別巡回はしない。',
      '重複は corporateNumber + 正規化職種名 + 雇用形態 + 勤務地 で duplicateGroupId を付けるだけで、統合も削除もしない。',
      '不明値は null。0 や false で埋めていない。',
    ],
    companies: perCompany.map(({ candidates, ...rest }) => ({
      ...rest,
      candidateCount: candidates.length,
      jobRecordCount: candidates.filter(isAnalysisRecord).length,
    })),
    jobs,
  };

  atomicWriteFile(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  atomicWriteFile(outExcluded, `${JSON.stringify({
    runDate: RUN_DATE,
    stage: 'stage5-jobs-v2-excluded',
    note: 'category / container / unknown、および jobTitleConfidence=low のレコード。求人件数には含めない。監査用に保持する。',
    counts: {
      total: excluded.length,
      byRecordType: countBy(excluded, (r) => r.recordType),
      byTitleConfidence: countBy(excluded, (r) => r.jobTitleConfidence),
      byReason: countBy(excluded, (r) => (
        !ANALYSIS_RECORD_TYPES.has(r.recordType) ? `type:${r.recordType}` : `confidence:${r.jobTitleConfidence}`
      )),
    },
    records: excluded,
  }, null, 2)}\n`, 'utf8');

  writeCsv(outCsv, [
    'corporateNumber', 'company', 'jobTitle', 'jobUrl', 'recordType',
    'jobTitleEvidence', 'jobTitleConfidence', 'employmentType', 'location',
    'salaryMin', 'salaryMax', 'salaryUnit', 'salarySource',
    'secondNewGrad', 'inexperienced', 'recentGraduate', 'potentialHire',
    'experienceYearsMin', 'practicalExperience', 'training', 'remote', 'fullRemote', 'portfolio',
    'requiredSkills', 'preferredSkills', 'fetchedAt',
    'duplicateGroupId', 'duplicateGroupSize', 'duplicateRank', 'isDuplicateOfEarlierRecord',
    'fieldScore', 'sourcePage', 'depth', 'httpStatus', 'robotsStatus',
  ], jobs.map((j) => ({ ...j, ...(j.flags ?? {}) })));

  console.log(JSON.stringify({ out: [outJson, outCsv, outExcluded], elapsedSeconds, counts: payload.counts, coverage: payload.fieldCoverageAmongJobRecords }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`ERROR: ${e?.stack ?? e}`); process.exit(1); });
}
