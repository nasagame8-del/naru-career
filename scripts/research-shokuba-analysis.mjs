#!/usr/bin/env node
/**
 * NARU Research stage 3: aggregate the Shokuba Rabo information/communications
 * seed together with the crawled recruitment-page dataset, and emit the
 * denominator-explicit analysis used to design articles.
 *
 * Inputs (both committed):
 * - data/research/shokuba/<date>-information-communications-seed.csv
 * - data/research/shokuba/<date>-recruitment-pages-pilot.json
 * Output:
 * - data/research/shokuba/<date>-analysis.json
 *
 * Rules enforced here:
 * - every rate carries its own denominator; nothing is divided by 8,118 unless
 *   8,118 really is the denominator
 * - a blank provider field is "not disclosed" (null), never 0 and never "no"
 * - leavers / hires is reported as exactly that, never as 定着率
 * - keyword flags are page-level mentions, not verified hiring conditions
 */
import fs from 'node:fs';
import path from 'node:path';

const RUN_DATE = '2026-10-04';
const DIR = path.join('data', 'research', 'shokuba');
const SEED_PATH = path.join(DIR, `${RUN_DATE}-information-communications-seed.csv`);
const PAGES_PATH = path.join(DIR, `${RUN_DATE}-recruitment-pages-pilot.json`);
const SUMMARY_PATH = path.join(DIR, `${RUN_DATE}-summary.json`);
const OUT_PATH = path.join(DIR, `${RUN_DATE}-analysis.json`);

const H = {
  corporateNumber: '法人番号',
  company: '企業名',
  prefecture: '都道府県',
  companySize: '企業規模',
  industry: '業種',
  homepage: '企業ホームページ',
  recruitmentPage: '採用ページ',
  youngHires: '新卒者等以外（35歳未満）の採用・定着状況(前年度/2年度前/3年度前)-男女計',
  youngLeavers: '新卒者等以外（35歳未満）の採用・定着状況(前年度/2年度前/3年度前)-離職者数',
  midCareerRatio: '中途採用比率(前年度/2年度前/3年度前)',
  training: '研修制度-有無',
  mentor: 'メンター制度-有無',
  selfDevelopment: '自己啓発支援制度-有無',
  careerConsulting: 'キャリアコンサルティング制度-有無',
  onboarding: 'オンボーディング制度・フォロー体制',
};

const SYSTEM_KEYS = ['training', 'mentor', 'selfDevelopment', 'careerConsulting'];

const SIZE_BANDS = [
  { key: '1-4人', min: 1, max: 4 },
  { key: '5-9人', min: 5, max: 9 },
  { key: '10-29人', min: 10, max: 29 },
  { key: '30-99人', min: 30, max: 99 },
  { key: '100-299人', min: 100, max: 299 },
  { key: '300-999人', min: 300, max: 999 },
  { key: '1000人以上', min: 1000, max: Infinity },
];

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
  const data = rows.slice(1).filter((r) => r.length === headers.length)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  return { headers, data, skipped: rows.length - 1 - data.length };
}

const trim = (v) => (typeof v === 'string' ? v.trim() : '');
const nonEmpty = (v) => trim(v).length > 0;
const rate = (n, d) => (d ? n / d : null);
const round = (v, p = 4) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(p)) : null);

/** "1:有" -> 'yes', "0:無" -> 'no', blank -> null (not disclosed). */
function yesNo(v) {
  const s = trim(v);
  if (!s) return null;
  if (/有/.test(s) && !/無/.test(s)) return 'yes';
  if (/無/.test(s)) return 'no';
  return 'other';
}

/** "0人/1人/0人" -> [0,1,0]; blank year -> null. */
function perYear(v) {
  const s = trim(v);
  if (!s) return [null, null, null];
  const parts = s.split('/');
  const out = [];
  for (let i = 0; i < 3; i += 1) {
    const chunk = parts[i] ?? '';
    const m = /-?\d[\d,]*(?:\.\d+)?/.exec(chunk);
    out.push(m ? Number(m[0].replace(/,/g, '')) : null);
  }
  return out;
}

function sizeOf(v) {
  const m = /-?\d[\d,]*/.exec(trim(v));
  return m ? Number(m[0].replace(/,/g, '')) : null;
}

function bandOf(size) {
  if (size === null) return '非開示';
  if (size <= 0) return '0人（開示値）';
  return SIZE_BANDS.find((b) => size >= b.min && size <= b.max)?.key ?? '非開示';
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function countBy(items, fn) {
  const map = new Map();
  for (const it of items) {
    const k = fn(it);
    const key = k === null || k === undefined ? 'null' : String(k);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]));
}

function yesNoBlock(rows, header) {
  const vals = rows.map((r) => yesNo(r[header]));
  const yes = vals.filter((v) => v === 'yes').length;
  const no = vals.filter((v) => v === 'no').length;
  const other = vals.filter((v) => v === 'other').length;
  const disclosed = yes + no + other;
  return {
    header,
    population: rows.length,
    disclosed,
    notDisclosed: rows.length - disclosed,
    disclosureRateAmongPopulation: round(rate(disclosed, rows.length)),
    yes,
    no,
    other,
    yesRateAmongDisclosed: round(rate(yes, disclosed)),
  };
}

// ---------------------------------------------------------------------------

function main() {
  const { data: rows, skipped } = readSeed(SEED_PATH);
  const pages = JSON.parse(fs.readFileSync(PAGES_PATH, 'utf8'));
  const stage1 = fs.existsSync(SUMMARY_PATH) ? JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8')) : null;

  const population = rows.length;

  // --- 1. disclosure coverage ---------------------------------------------
  const systemState = rows.map((r) => SYSTEM_KEYS.map((k) => yesNo(r[H[k]])));
  const anySystemDisclosed = systemState.filter((s) => s.some((v) => v !== null)).length;
  const allSystemsDisclosed = systemState.filter((s) => s.every((v) => v !== null)).length;
  const youngRows = rows.filter((r) => nonEmpty(r[H.youngHires]) || nonEmpty(r[H.youngLeavers]));
  const midRows = rows.filter((r) => perYear(r[H.midCareerRatio]).some((v) => v !== null));
  const recruitRows = rows.filter((r) => /^https?:\/\//i.test(trim(r[H.recruitmentPage])));
  const homepageRows = rows.filter((r) => nonEmpty(r[H.homepage]));

  const youngOrSystemOrPage = rows.filter((r, i) => (
    systemState[i].some((v) => v !== null)
    || nonEmpty(r[H.youngHires]) || nonEmpty(r[H.youngLeavers])
    || /^https?:\/\//i.test(trim(r[H.recruitmentPage]))
  )).length;

  const disclosureCoverage = {
    population,
    note: '母数は情報通信業の全掲載企業。しょくばらぼは任意開示項目が多く、空欄は「制度なし」ではなく「未開示」。',
    homepageUrl: { count: homepageRows.length, rate: round(rate(homepageRows.length, population)) },
    recruitmentPageUrl: {
      rowCount: recruitRows.length,
      distinctUrlCount: pages.targetCount ?? null,
      rate: round(rate(recruitRows.length, population)),
    },
    anyOfFourDevelopmentSystemsDisclosed: { count: anySystemDisclosed, rate: round(rate(anySystemDisclosed, population)) },
    allFourDevelopmentSystemsDisclosed: { count: allSystemsDisclosed, rate: round(rate(allSystemsDisclosed, population)) },
    youngUnder35HiringDataDisclosed: { count: youngRows.length, rate: round(rate(youngRows.length, population)) },
    midCareerRatioDisclosed: { count: midRows.length, rate: round(rate(midRows.length, population)) },
    onboardingTextDisclosed: {
      count: rows.filter((r) => nonEmpty(r[H.onboarding])).length,
      rate: round(rate(rows.filter((r) => nonEmpty(r[H.onboarding])).length, population)),
    },
    anyYoungTalentSignalDisclosed: {
      definition: '4制度のいずれか、または35歳未満採用データ、または採用ページURLのいずれかを開示',
      count: youngOrSystemOrPage,
      rate: round(rate(youngOrSystemOrPage, population)),
    },
  };

  // --- 2..5. development systems ------------------------------------------
  const developmentSystems = Object.fromEntries(
    SYSTEM_KEYS.map((k) => [k, yesNoBlock(rows, H[k])]),
  );

  // --- 6. under-35 hiring / separation ------------------------------------
  const youngDetail = rows.map((r) => ({
    hires: perYear(r[H.youngHires]),
    leavers: perYear(r[H.youngLeavers]),
    size: sizeOf(r[H.companySize]),
  }));
  const anyYoung = youngDetail.filter((d) => d.hires.some((v) => v !== null) || d.leavers.some((v) => v !== null));
  const bothAllYears = anyYoung.filter((d) => d.hires.every((v) => v !== null) && d.leavers.every((v) => v !== null));
  const pairYears = [];
  for (const d of anyYoung) {
    for (let i = 0; i < 3; i += 1) {
      if (d.hires[i] !== null && d.leavers[i] !== null) pairYears.push({ h: d.hires[i], l: d.leavers[i] });
    }
  }
  const hiresSum = pairYears.reduce((a, b) => a + b.h, 0);
  const leaversSum = pairYears.reduce((a, b) => a + b.l, 0);
  const totalHiresPerCompany = bothAllYears.map((d) => d.hires.reduce((a, b) => a + b, 0));
  const zeroHireCompanies = totalHiresPerCompany.filter((v) => v === 0).length;
  const positiveHireCompanies = totalHiresPerCompany.filter((v) => v > 0).length;
  const positiveRows = bothAllYears.filter((d) => d.hires.reduce((a, b) => a + b, 0) > 0);
  const posHires = positiveRows.reduce((a, d) => a + d.hires.reduce((x, y) => x + y, 0), 0);
  const posLeavers = positiveRows.reduce((a, d) => a + d.leavers.reduce((x, y) => x + y, 0), 0);

  const youngUnder35 = {
    population,
    rowsWithAnyData: anyYoung.length,
    disclosureRate: round(rate(anyYoung.length, population)),
    rowsWithAllThreeYearsOnBothFields: bothAllYears.length,
    yearPairsUsed: pairYears.length,
    hiresSumOverYearPairs: hiresSum,
    leaversSumOverYearPairs: leaversSum,
    leaversPerHireOverYearPairs: round(rate(leaversSum, hiresSum)),
    companiesWithZeroThreeYearHires: zeroHireCompanies,
    companiesWithPositiveThreeYearHires: positiveHireCompanies,
    zeroHireShareAmongFullyDisclosed: round(rate(zeroHireCompanies, bothAllYears.length)),
    medianThreeYearHiresAmongPositive: median(totalHiresPerCompany.filter((v) => v > 0)),
    hiresSumAmongPositiveCompanies: posHires,
    leaversSumAmongPositiveCompanies: posLeavers,
    leaversPerHireAmongPositiveCompanies: round(rate(posLeavers, posHires)),
    interpretationWarning: [
      '「離職者数 ÷ 採用者数」はコホート追跡ではないため、定着率・離職率と呼べない。',
      '離職者はその年度の35歳未満全体であり、同年度に採用された人だけではない。',
      '3年合計の単純比であり、企業規模で重み付けしていない。',
      '開示企業は全体の一部（self-selection）なので情報通信業全体の値ではない。',
    ],
  };

  // --- 10. size / prefecture breakdowns -----------------------------------
  const bands = [...SIZE_BANDS.map((b) => b.key), '0人（開示値）', '非開示'];
  const bySizeBand = {};
  for (const band of bands) {
    const sub = rows.filter((r) => bandOf(sizeOf(r[H.companySize])) === band);
    if (!sub.length) continue;
    bySizeBand[band] = {
      companies: sub.length,
      recruitmentPageUrl: {
        count: sub.filter((r) => /^https?:\/\//i.test(trim(r[H.recruitmentPage]))).length,
        rate: round(rate(sub.filter((r) => /^https?:\/\//i.test(trim(r[H.recruitmentPage]))).length, sub.length)),
      },
      homepageUrl: {
        count: sub.filter((r) => nonEmpty(r[H.homepage])).length,
        rate: round(rate(sub.filter((r) => nonEmpty(r[H.homepage])).length, sub.length)),
      },
      systems: Object.fromEntries(SYSTEM_KEYS.map((k) => {
        const b = yesNoBlock(sub, H[k]);
        return [k, {
          disclosed: b.disclosed,
          disclosureRate: b.disclosureRateAmongPopulation,
          yes: b.yes,
          no: b.no,
          yesRateAmongDisclosed: b.yesRateAmongDisclosed,
        }];
      })),
      youngUnder35Disclosed: sub.filter((r) => nonEmpty(r[H.youngHires]) || nonEmpty(r[H.youngLeavers])).length,
    };
  }

  const prefCounts = countBy(rows, (r) => trim(r[H.prefecture]) || null);
  const topPrefectures = Object.entries(prefCounts).slice(0, 10).map(([pref, companies]) => {
    const sub = rows.filter((r) => trim(r[H.prefecture]) === pref);
    const t = yesNoBlock(sub, H.training);
    return {
      prefecture: pref,
      companies,
      shareOfPopulation: round(rate(companies, population)),
      recruitmentPageUrlCount: sub.filter((r) => /^https?:\/\//i.test(trim(r[H.recruitmentPage]))).length,
      trainingDisclosed: t.disclosed,
      trainingYesRateAmongDisclosed: t.yesRateAmongDisclosed,
    };
  });

  // --- recruitment pages: quality + 7/8/9 ---------------------------------
  const results = pages.results ?? [];
  const ok = results.filter((r) => r.fetchOk);
  const hostCat = (r) => r.classification?.finalHostCategory ?? r.classification?.hostCategory ?? 'unknown';
  const companyControlled = ok.filter((r) => ['ownDomain', 'atsHosted'].includes(hostCat(r)));
  const ownDomainOnly = ok.filter((r) => hostCat(r) === 'ownDomain');
  const thirdParty = results.filter((r) => hostCat(r) === 'jobPlatform');

  const flagKeys = Object.keys(ok[0]?.flags ?? {});
  const flagBlock = (subset) => Object.fromEntries(flagKeys.map((k) => {
    const known = subset.filter((r) => typeof r.flags?.[k] === 'boolean');
    const yes = known.filter((r) => r.flags[k] === true).length;
    return [k, { denominator: known.length, count: yes, rate: round(rate(yes, known.length)) }];
  }));

  const dedupeSources = results.filter((r) => (r.sourceUrlCount ?? 1) > 1)
    .map((r) => ({ sourceUrl: r.sourceUrl, companies: r.duplicateCompanies }));
  const companyUrlCounts = new Map();
  for (const r of results) {
    const key = r.corporateNumber || r.company;
    if (!key) continue;
    companyUrlCounts.set(key, (companyUrlCounts.get(key) ?? 0) + 1);
  }
  const companiesWithMultipleUrls = [...companyUrlCounts.entries()].filter(([, n]) => n > 1)
    .map(([k, n]) => ({ company: k, urlCount: n }));

  const quality = {
    listedUrlRows: pages.listedUrlRows ?? null,
    distinctUrlsRequested: pages.targetCount ?? null,
    duplicateUrlsSharedByMultipleRows: dedupeSources,
    companiesWithMultipleRecruitmentUrls: companiesWithMultipleUrls,
    fetchOutcome: {
      success: ok.length,
      failure: results.length - ok.length,
      successRate: round(rate(ok.length, results.length)),
      statusCounts: pages.statusCounts ?? null,
      errorCounts: pages.errorCounts ?? null,
    },
    failureBreakdown: {
      http404: results.filter((r) => r.httpStatus === 404).length,
      http403: results.filter((r) => r.httpStatus === 403).length,
      http429: results.filter((r) => r.httpStatus === 429).length,
      http5xx: results.filter((r) => typeof r.httpStatus === 'number' && r.httpStatus >= 500).length,
      blockedByRobots: results.filter((r) => r.robotsStatus === 'blocked').length,
      timeoutOrTransport: results.filter((r) => !r.fetchOk && r.httpStatus === null && r.robotsStatus !== 'blocked').length,
      nonHtml: results.filter((r) => r.fetchError === 'non_html_content').length,
    },
    robotsStatusCounts: countBy(results, (r) => r.robotsStatus),
    redirects: {
      pagesRedirected: results.filter((r) => r.redirected === true).length,
      redirectedToDifferentRegistrableDomain: ok.filter((r) => r.redirected && r.classification?.sameRegistrableDomainAsHomepage === false).length,
      redirectedIntoJobPlatform: ok.filter((r) => r.redirected && r.classification?.finalHostCategory === 'jobPlatform').length,
    },
    hostCategoryCounts: countBy(results, (r) => r.classification?.hostCategory),
    finalHostCategoryCountsAmongSuccess: countBy(ok, (r) => r.classification?.finalHostCategory),
    pageTypeCountsAmongSuccess: countBy(ok, (r) => r.classification?.pageTypeGuess),
    notADedicatedRecruitmentPage: {
      definition: 'pageTypeGuess が homeTop / topPageAnchor / otherPage のもの（トップページやサービスページが採用ページ欄に登録されている）',
      count: ok.filter((r) => ['homeTop', 'topPageAnchor', 'otherPage'].includes(r.classification?.pageTypeGuess)).length,
      denominator: ok.length,
    },
    staleNewGradPages: {
      definition: 'ページ内で言及される最新の「20XX年卒/年度卒」が2026年より前',
      count: ok.filter((r) => r.classification?.staleNewGradYear === true).length,
      denominator: ok.filter((r) => r.classification?.graduationYearsMentioned).length,
    },
    newGradOnlyPages: {
      definition: '「新卒」に言及し、「中途採用/キャリア採用/経験者採用/第二新卒」に一切言及しないページ',
      count: ok.filter((r) => r.classification?.newGradOnly === true).length,
      denominator: ok.length,
    },
    javascriptDependentSuspected: {
      definition: 'HTTP 200だが本文可視テキストが400文字未満（JS描画・空ページの疑い）',
      count: ok.filter((r) => r.classification?.jsDependentSuspected === true).length,
      denominator: ok.length,
    },
    thirdPartyJobPlatformUrls: {
      definition: 'しょくばらぼの採用ページ欄に第三者求人プラットフォームのURLが登録されているもの。URLと事実のみ記録し、追加クロールはしない。',
      count: thirdParty.length,
      denominator: results.length,
      hosts: countBy(thirdParty, (r) => {
        try { return new URL(r.sourceUrl).hostname.replace(/^www\./, ''); } catch { return null; }
      }),
    },
    pagesLinkingOutToJobPlatforms: {
      count: ok.filter((r) => (r.jobPlatformLinkHosts ?? []).length > 0).length,
      denominator: ok.length,
    },
    visibleCharsMedianAmongSuccess: median(ok.map((r) => r.visibleChars).filter((v) => typeof v === 'number')),
  };

  const recruitmentPageMentions = {
    note: 'キーワードは「ページ上に語が出現した」ことのみを示す。求人条件の確認でも、職種別の条件でもない。取得できなかったページは母数から除外し、0件として扱っていない。',
    denominators: {
      distinctUrlsRequested: results.length,
      successfullyFetched: ok.length,
      companyControlledPages: companyControlled.length,
      ownDomainPages: ownDomainOnly.length,
      thirdPartyPlatformPages: thirdParty.length,
    },
    amongSuccessfullyFetched: flagBlock(ok),
    amongCompanyControlledPages: flagBlock(companyControlled),
    amongOwnDomainPages: flagBlock(ownDomainOnly),
  };

  const postings = ok.flatMap((r) => r.jobPostings ?? []);
  const jobPosting = {
    denominator: ok.length,
    pagesWithJobPostingJsonLd: ok.filter((r) => r.jobPostingJsonLd === true).length,
    rate: round(rate(ok.filter((r) => r.jobPostingJsonLd === true).length, ok.length)),
    pagesWithAnyJsonLd: ok.filter((r) => (r.jsonLdBlocks ?? 0) > 0).length,
    parsedPostingCount: postings.length,
    postingsWithTitle: postings.filter((p) => p.title).length,
    postingsWithEmploymentType: postings.filter((p) => p.employmentType).length,
    postingsWithSalaryValue: postings.filter((p) => p.salaryMin !== null || p.salaryMax !== null).length,
    postingsWithExperienceRequirements: postings.filter((p) => p.experienceRequirements).length,
    postingsWithSkills: postings.filter((p) => p.skills).length,
    postingsWithLocation: postings.filter((p) => p.jobLocation).length,
    titles: [...new Set(postings.map((p) => p.title).filter(Boolean))].slice(0, 50),
    note: '構造化データが少ないため、年収・必須経験年数・スキルの定量集計には母数が足りない。記事で断定的な分布を出さない。',
  };

  // Cross-reference: do companies that published a recruitment page also
  // disclose development systems? Denominator is the seed rows, not the pages.
  const recruitSet = new Set(recruitRows.map((r) => trim(r[H.corporateNumber])));
  const withPage = rows.filter((r) => recruitSet.has(trim(r[H.corporateNumber])) && nonEmpty(trim(r[H.corporateNumber])));
  const withoutPage = rows.filter((r) => !recruitSet.has(trim(r[H.corporateNumber])));
  const crossTab = {
    note: '採用ページURLを出している企業と出していない企業の制度開示を比較。相関であり因果ではない。',
    withRecruitmentPageUrl: {
      companies: withPage.length,
      systems: Object.fromEntries(SYSTEM_KEYS.map((k) => [k, yesNoBlock(withPage, H[k])])),
    },
    withoutRecruitmentPageUrl: {
      companies: withoutPage.length,
      systems: Object.fromEntries(SYSTEM_KEYS.map((k) => [k, yesNoBlock(withoutPage, H[k])])),
    },
  };

  // Composite view: does the page give a second-new-grad reader any entry point?
  const NEW_GRAD_BOARDS = ['job.mynavi.jp', 'job.rikunabi.com', 'job.career-tasu.jp'];
  const hostName = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
  const anyEntry = (r) => ['secondNewGrad', 'inexperienced', 'recentGraduate', 'potentialHire'].some((k) => r.flags?.[k] === true);
  const entryPoints = {
    note: '母数は自社ドメイン/ATS上の採用ページを取得できた企業。語の出現有無であり、実際の応募可否ではない。',
    denominator: companyControlled.length,
    anyEntryMention: {
      definition: '第二新卒 / 未経験・経験不問 / 既卒 / ポテンシャル採用 のいずれかに言及',
      count: companyControlled.filter(anyEntry).length,
      rate: round(rate(companyControlled.filter(anyEntry).length, companyControlled.length)),
    },
    noEntryMention: {
      count: companyControlled.filter((r) => !anyEntry(r)).length,
      rate: round(rate(companyControlled.filter((r) => !anyEntry(r)).length, companyControlled.length)),
    },
    secondNewGradAndEngineer: companyControlled.filter((r) => r.flags?.secondNewGrad && r.flags?.engineer).length,
    inexperiencedAndEngineer: companyControlled.filter((r) => r.flags?.inexperienced && r.flags?.engineer).length,
    noSalaryMention: {
      count: companyControlled.filter((r) => r.flags?.salaryMention === false).length,
      rate: round(rate(companyControlled.filter((r) => r.flags?.salaryMention === false).length, companyControlled.length)),
    },
    newGradOnly: companyControlled.filter((r) => r.classification?.newGradOnly === true).length,
    newGradJobBoardUrls: {
      definition: '採用ページ欄に新卒就活サイト（マイナビ/リクナビ/キャリタス就活）のURLが登録されている件数',
      denominator: results.length,
      count: results.filter((r) => NEW_GRAD_BOARDS.includes(hostName(r.sourceUrl))).length,
      hosts: countBy(results.filter((r) => NEW_GRAD_BOARDS.includes(hostName(r.sourceUrl))), (r) => hostName(r.sourceUrl)),
      redirectedToExpiredOrGenericListing: ok.filter((r) => r.redirected && r.classification?.finalHostCategory === 'jobPlatform')
        .map((r) => ({ sourceUrl: r.sourceUrl, finalUrl: r.finalUrl })),
    },
  };

  // Join: the company says "有" in the official dataset — does its own
  // recruitment page actually mention it? Only the two systems that have a
  // directly comparable page keyword are joined; the other two have no
  // unambiguous page wording and are deliberately left out.
  const seedByCorp = new Map();
  for (const r of rows) {
    const key = trim(r[H.corporateNumber]);
    if (key) seedByCorp.set(key, r);
  }
  const joinable = companyControlled.filter((r) => seedByCorp.has(trim(r.corporateNumber)));
  const gapFor = (systemKey, flagKey) => {
    const subset = (state) => joinable.filter((r) => yesNo(seedByCorp.get(trim(r.corporateNumber))[H[systemKey]]) === state);
    const yesRows = subset('yes');
    const noRows = subset('no');
    const mentions = (arr) => arr.filter((r) => r.flags?.[flagKey] === true).length;
    return {
      systemHeader: H[systemKey],
      pageFlag: flagKey,
      disclosedYes: {
        denominator: yesRows.length,
        pagesMentioningIt: mentions(yesRows),
        rate: round(rate(mentions(yesRows), yesRows.length)),
      },
      disclosedNo: {
        denominator: noRows.length,
        pagesMentioningIt: mentions(noRows),
        rate: round(rate(mentions(noRows), noRows.length)),
        note: '公式データでは「無」だがページに語が出現するケース。表記ゆれ・別文脈の可能性があり、矛盾と断定しない。',
      },
    };
  };
  const systemVsPageGap = {
    note: '母数は「自社ドメイン/ATS上の採用ページを取得できた企業」に限定。制度の実在性ではなく、採用ページ上で言及しているかを見る。',
    joinableCompanies: joinable.length,
    training: gapFor('training', 'training'),
    mentor: gapFor('mentor', 'mentor'),
  };

  const analysis = {
    runDate: RUN_DATE,
    generatedAtUtc: new Date().toISOString(),
    generator: 'scripts/research-shokuba-analysis.mjs',
    sources: {
      shokubaCsv: stage1?.source ?? null,
      seedCsv: SEED_PATH,
      recruitmentPages: {
        file: PAGES_PATH,
        crawler: pages.crawler ?? null,
        crawledAtUtc: pages.generatedAtUtc ?? null,
        settings: pages.settings ?? null,
      },
      seedRowsSkippedAsMalformed: skipped,
    },
    population: {
      allShokubaRows: stage1?.dataset?.allCompanyRows ?? null,
      informationCommunicationsRows: population,
      industryFilter: '業種に「情報通信業」を含む行',
    },
    disclosureCoverage,
    developmentSystems,
    youngUnder35,
    bySizeBand,
    topPrefectures,
    recruitmentPageQuality: quality,
    recruitmentPageMentions,
    secondNewGradEntryPoints: entryPoints,
    jobPostingStructuredData: jobPosting,
    recruitmentPageVsDisclosureCrossTab: crossTab,
    disclosedSystemVsPageMentionGap: systemVsPageGap,
    guardrails: [
      '欠損は null。0件や「制度なし」と読み替えない。',
      '割合は必ず対応する母数と併記する。開示275社の値を8,118社の値として書かない。',
      '離職者数÷採用者数を定着率・離職率と書かない。',
      '採用ページのキーワードは出現有無であり、募集条件の裏取りではない。',
      'しょくばらぼは任意掲載・任意開示なので、情報通信業の母集団を代表しない。',
      '第三者求人サイトはURLの事実のみ。追加クロールや本文転載はしない。',
    ],
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    out: OUT_PATH,
    population,
    recruitmentUrlRows: recruitRows.length,
    pagesFetched: ok.length,
    pagesRequested: results.length,
    anySystemDisclosed,
    youngRows: anyYoung.length,
  }, null, 2));
}

main();
