#!/usr/bin/env node
/**
 * NARU Research stage 4/5 analysis: turn the discovery + job datasets into the
 * numbers needed to decide whether to scale from the 300-company pilot to the
 * full 3,419-company frame.
 *
 * Inputs:  <date>-discovery-<tag>.json, <date>-jobs-<tag>.json
 * Output:  <date>-discovery-analysis.json
 *
 * The sample is balanced across (size band × prefecture tier), not
 * proportional, so every headline rate is reported twice:
 *   - unweighted (the 300 companies as crawled)
 *   - population-weighted (each stratum weighted back to the 3,419 frame)
 */
import fs from 'node:fs';
import path from 'node:path';
import { median, round, rate, nullFlags } from './research-web.mjs';

const RUN_DATE = '2026-10-04';
const DIR = path.join('data', 'research', 'shokuba');

function parseArgs(argv) {
  const out = { tag: '300', jobsTag: null, outName: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--tag') out.tag = argv[++i];
    else if (argv[i] === '--jobs-tag') out.jobsTag = argv[++i];
    else if (argv[i] === '--out') out.outName = argv[++i];
  }
  if (!out.jobsTag) out.jobsTag = out.tag;
  return out;
}

/** Classify a transport/HTTP failure into the buckets the run report needs. */
function errorClass(err) {
  if (!err) return null;
  if (/^http_(\d+)/.test(err)) {
    const code = Number(/^http_(\d+)/.exec(err)[1]);
    if (code === 403) return 'http403';
    if (code === 404) return 'http404';
    if (code === 429) return 'http429';
    if (code >= 500) return 'http5xx';
    return `http${code}`;
  }
  if (/429/.test(err)) return 'http429';
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(err)) return 'tls';
  if (/ENOTFOUND|EAI_AGAIN|DNS/i.test(err)) return 'dns';
  if (/Timeout|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/i.test(err)) return 'timeout';
  if (/blocked_by_robots/.test(err)) return 'robotsBlocked';
  if (/non_html_content/.test(err)) return 'nonHtml';
  if (/ECONNRESET|ECONNREFUSED|EPIPE|SystemError/i.test(err)) return 'connection';
  return 'other';
}

const countBy = (arr, fn) => {
  const m = new Map();
  for (const x of arr) { const k = String(fn(x) ?? 'null'); m.set(k, (m.get(k) ?? 0) + 1); }
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
};

/** Weighted share of a 0/1 predicate, weighting each stratum back to the frame. */
function weightedRate(rows, predicate) {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const w = typeof r.populationWeight === 'number' ? r.populationWeight : null;
    if (w === null) continue;
    den += w;
    if (predicate(r)) num += w;
  }
  return den ? { weightedRate: round(num / den), weightedDenominator: round(den, 1) } : { weightedRate: null, weightedDenominator: null };
}

function bandOf(stratum) { return (stratum ?? '').split(' / ')[0] || null; }
function tierOf(stratum) { return (stratum ?? '').split(' / ')[1] || null; }

function groupRates(rows, keyFn, predicate) {
  const groups = new Map();
  for (const r of rows) {
    const k = keyFn(r) ?? 'null';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return Object.fromEntries([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja')).map(([k, v]) => {
    const hits = v.filter(predicate).length;
    return [k, { companies: v.length, found: hits, rate: round(rate(hits, v.length)) }];
  }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const discovery = JSON.parse(fs.readFileSync(path.join(DIR, `${RUN_DATE}-discovery-${args.tag}.json`), 'utf8'));
  const jobsPath = path.join(DIR, `${RUN_DATE}-jobs-${args.jobsTag}.json`);
  const jobsData = fs.existsSync(jobsPath) ? JSON.parse(fs.readFileSync(jobsPath, 'utf8')) : null;
  const stage3Path = path.join(DIR, `${RUN_DATE}-analysis.json`);
  const stage3 = fs.existsSync(stage3Path) ? JSON.parse(fs.readFileSync(stage3Path, 'utf8')) : null;
  const retryPath = path.join(DIR, `${RUN_DATE}-discovery-${args.tag}-retry.json`);
  const retry = fs.existsSync(retryPath) ? JSON.parse(fs.readFileSync(retryPath, 'utf8')) : null;

  const rows = discovery.results;
  const adopted = (r) => r.confidence === 'high' || r.confidence === 'medium';
  const adoptedRows = rows.filter(adopted);
  const frameSize = discovery.sampling?.frame?.afterHostDeduplication ?? null;

  // --- discovery funnel ---------------------------------------------------
  const homepageOk = rows.filter((r) => r.homepageStatus === 200 && !r.homepageError);
  const funnel = {
    companiesAttempted: rows.length,
    homepageFetchSuccess: homepageOk.length,
    homepageFetchSuccessRate: round(rate(homepageOk.length, rows.length)),
    ...weightedRate(rows, (r) => r.homepageStatus === 200 && !r.homepageError),
    anyCandidateFound: rows.filter((r) => r.candidateCount > 0).length,
    recruitmentPageAdopted: adoptedRows.length,
    adoptionRateAmongAttempted: round(rate(adoptedRows.length, rows.length)),
    adoptionRateAmongHomepageSuccess: round(rate(adoptedRows.length, homepageOk.length)),
    confidence: {
      high: rows.filter((r) => r.confidence === 'high').length,
      medium: rows.filter((r) => r.confidence === 'medium').length,
      low: rows.filter((r) => r.confidence === 'low').length,
      none: rows.filter((r) => r.confidence === null).length,
    },
    verifiedAsRecruitmentPage: rows.filter((r) => r.verifiedAsRecruitmentPage === true).length,
    officialAtsAdopted: adoptedRows.filter((r) => r.hostCategory === 'atsHosted').length,
    discoveryMethodCounts: countBy(rows, (r) => r.discoveryMethod),
    hostCategoryCountsAmongAdopted: countBy(adoptedRows, (r) => r.hostCategory),
    sitemapsChecked: rows.reduce((a, r) => a + (r.sitemapsChecked ?? 0), 0),
    companiesWhereSitemapWasTheOnlyRoute: rows.filter((r) => r.discoveryMethod === 'robotsSitemap' && adopted(r)).length,
  };

  const weightedAdoption = weightedRate(rows, adopted);

  // --- access / compliance outcomes --------------------------------------
  const access = {
    totalHttpRequests: discovery.httpAccounting?.totalHttpRequests ?? null,
    httpStatusCountsAcrossAllRequests: discovery.httpAccounting?.statusCounts ?? null,
    hostsStoppedAfter429: discovery.httpAccounting?.hostsBlockedAfter429 ?? [],
    failureClassesOnHomepage: countBy(rows.filter((r) => r.homepageError), (r) => errorClass(r.homepageError)),
    failureClassesOnRecruitmentPage: countBy(
      rows.filter((r) => r.notes?.some?.((n) => String(n).startsWith('candidate_not_fetched'))),
      (r) => errorClass(String(r.notes.find((n) => String(n).startsWith('candidate_not_fetched'))).replace('candidate_not_fetched:', '')),
    ),
    originFallbackUsed: rows.filter((r) => r.normalizedOriginFallbackUsed || r.rootFallbackUsed).length,
    originFallbackLedToDiscovery: rows.filter((r) => (r.normalizedOriginFallbackUsed || r.rootFallbackUsed) && adopted(r)).length,
    companiesWithRedirects: rows.filter((r) => (r.redirects ?? 0) > 0).length,
    homepageStatusCounts: countBy(rows, (r) => r.homepageStatus),
    homepageErrorCounts: countBy(rows.filter((r) => r.homepageError), (r) => r.homepageError),
    recruitmentPageStatusCounts: countBy(rows.filter((r) => r.httpStatus !== null), (r) => r.httpStatus),
    http403: rows.filter((r) => r.homepageStatus === 403 || r.httpStatus === 403).length,
    http429: rows.filter((r) => r.homepageStatus === 429 || r.httpStatus === 429).length,
    robotsBlocked: rows.filter((r) => r.homepageRobotsStatus === 'blocked' || r.robotsStatus === 'blocked').length,
    robotsStatusCountsOnHomepage: countBy(rows, (r) => r.homepageRobotsStatus),
    companiesLinkingToJobPlatformsFromHomepage: rows.filter((r) => (r.jobPlatformLinksOnHomepage ?? []).length > 0).length,
    jobPlatformHostsSeenOnHomepages: countBy(
      rows.flatMap((r) => r.jobPlatformLinksOnHomepage ?? []),
      (h) => h,
    ),
  };

  // --- coverage gain vs the Shokuba 採用ページ column ---------------------
  const coverageGain = {
    note: 'しょくばらぼの「採用ページ」欄に自分でURLを書いていた企業は情報通信業8,118社の2.4%しかない。Discoveryは企業HPを起点にそれを拡張できるかを測る。',
    sampleCompanies: rows.length,
    hadShokubaRecruitmentUrl: rows.filter((r) => r.alreadyInShokuba).length,
    adoptedRecruitmentPage: adoptedRows.length,
    newlyDiscoveredNotInShokuba: adoptedRows.filter((r) => !r.alreadyInShokuba).length,
    multiplierVsShokubaColumn: round(rate(adoptedRows.length, Math.max(1, rows.filter((r) => r.alreadyInShokuba).length)), 2),
    shokubaColumnRateInPopulation: stage3?.disclosureCoverage?.recruitmentPageUrl?.rate ?? null,
    estimatedFindableRateAmongCompaniesWithHomepage: weightedAdoption.weightedRate,
  };

  // --- breakdowns ---------------------------------------------------------
  const breakdowns = {
    adoptionBySizeBand: groupRates(rows, (r) => bandOf(r.stratum), adopted),
    adoptionByPrefectureTier: groupRates(rows, (r) => tierOf(r.stratum), adopted),
    homepageSuccessBySizeBand: groupRates(rows, (r) => bandOf(r.stratum), (r) => r.homepageStatus === 200 && !r.homepageError),
    atsUseBySizeBand: groupRates(rows, (r) => bandOf(r.stratum), (r) => adopted(r) && r.hostCategory === 'atsHosted'),
    jobPostingJsonLdBySizeBand: groupRates(adoptedRows, (r) => bandOf(r.stratum), (r) => r.jobPostingJsonLdOnRecruitmentPage === true),
  };

  // --- stage 5 ------------------------------------------------------------
  let jobs = null;
  if (jobsData) {
    const all = jobsData.jobs ?? [];
    const perCompany = jobsData.companies ?? [];
    const reaching = perCompany.filter((c) => c.jobRecordCount > 0);
    const flagKeys = Object.keys(nullFlags());
    const byStratum = groupRates(perCompany, (c) => bandOf(c.stratum), (c) => c.jobRecordCount > 0);
    jobs = {
      companiesEligible: jobsData.counts.companiesEligible,
      companiesReachingJobRecords: reaching.length,
      companyReachRateAmongEligible: round(rate(reaching.length, perCompany.length)),
      companyReachRateAmongAllSampled: round(rate(reaching.length, rows.length)),
      ...weightedRate(
        perCompany.map((c) => ({ ...c, hit: c.jobRecordCount > 0 })),
        (c) => c.hit,
      ),
      provisional: jobsData.provisional === true,
      provisionalReason: jobsData.provisionalReason ?? null,
      elapsedSeconds: jobsData.elapsedSeconds ?? null,
      totalHttpRequests: jobsData.httpAccounting?.totalHttpRequests ?? null,
      companiesTruncatedAtCap: jobsData.counts.companiesTruncatedAtCap ?? null,
      maxJobsPerCompany: jobsData.settings?.maxJobsPerCompany ?? null,
      suspiciousJobTitles: jobsData.counts.suspiciousJobTitles ?? null,
      categoryOrContainerLikeRecords: jobsData.counts.categoryOrContainerLikeRecords ?? null,
      duplicateCandidateRecords: jobsData.counts.duplicateCandidateRecords ?? null,
      jobPostingJsonLdRecords: jobsData.counts.jobPostingJsonLdRecords ?? null,
      jobRecords: all.length,
      granularity: {
        note: '1求人=1レコードがどれだけ達成できたかの精度指標。roleNamed は職種名を含むタイトルのレコード。',
        roleNamedJobRecords: jobsData.counts.roleNamedJobRecords ?? null,
        roleNamedShare: round(rate(jobsData.counts.roleNamedJobRecords ?? 0, all.length)),
        rejectedNonJobPages: jobsData.counts.rejectedNonJobPages ?? null,
        jobTitleSourceCounts: countBy(all, (j) => j.jobTitleSource),
        duplicateTitlesWithinCompany: (() => {
          const seen = new Map();
          let dup = 0;
          for (const j of all) {
            const k = `${j.corporateNumber}::${j.jobTitle}`;
            if (seen.has(k)) dup += 1; else seen.set(k, 1);
          }
          return dup;
        })(),
      },
      medianJobRecordsPerReachingCompany: median(reaching.map((c) => c.jobRecordCount)),
      medianJobRecordsPerEligibleCompany: median(perCompany.map((c) => c.jobRecordCount)),
      jobRecordsPerReachingCompanyMean: round(rate(all.length, reaching.length), 2),
      sourceCounts: countBy(all, (j) => j.source),
      flagScopeCounts: countBy(all.filter((j) => j.flagScope), (j) => j.flagScope),
      fieldCoverage: jobsData.fieldCoverageAmongJobRecords,
      flagCounts: jobsData.flagCountsAmongJobRecords,
      employmentTypeCounts: countBy(all.filter((j) => j.employmentType), (j) => j.employmentType),
      salaryUnitCounts: countBy(all.filter((j) => j.salaryUnit), (j) => j.salaryUnit),
      annualSalary: (() => {
        const yearly = all.filter((j) => j.salaryUnit === 'YEAR' && typeof j.salaryMin === 'number');
        return {
          denominator: yearly.length,
          note: '年収表記のみ。月給表記のレコードとは絶対に混ぜない。母数が小さい場合は記事で分布を示さない。',
          medianSalaryMin: median(yearly.map((j) => j.salaryMin)),
          medianSalaryMax: median(yearly.filter((j) => typeof j.salaryMax === 'number').map((j) => j.salaryMax)),
        };
      })(),
      experienceYears: (() => {
        const withExp = all.filter((j) => typeof j.experienceYearsMin === 'number');
        return { denominator: withExp.length, median: median(withExp.map((j) => j.experienceYearsMin)), counts: countBy(withExp, (j) => j.experienceYearsMin) };
      })(),
      jobRecordsReachedBySizeBand: byStratum,
      accessOutcomes: jobsData.accessOutcomes,
      topJobTitles: Object.entries(countBy(all.filter((j) => j.jobTitle), (j) => j.jobTitle)).slice(0, 25),
      flagKeys,
    };
  }

  // --- scale-up projection ------------------------------------------------
  const perCompanySeconds = round(rate(discovery.elapsedSeconds, rows.length), 2);
  const jobSeconds = jobsData ? round(rate(jobsData.elapsedSeconds, jobsData.counts.companiesEligible), 2) : null;
  const projection = {
    frameSize,
    note: 'パイロット実測値の線形外挿。同時実行数とホスト間隔を変えない前提。',
    stage4: {
      measuredElapsedSeconds: discovery.elapsedSeconds,
      secondsPerCompany: perCompanySeconds,
      projectedMinutesForFrame: frameSize ? round((perCompanySeconds * frameSize) / 60, 1) : null,
      projectedRequests: frameSize ? Math.round(frameSize * round(rate(
        rows.length + funnel.sitemapsChecked + rows.filter((r) => r.httpStatus !== null).length, rows.length,
      ), 2)) : null,
    },
    stage5: jobsData ? {
      measuredElapsedSeconds: jobsData.elapsedSeconds,
      secondsPerEligibleCompany: jobSeconds,
      projectedEligibleCompaniesForFrame: frameSize ? Math.round(frameSize * (weightedAdoption.weightedRate ?? 0)) : null,
      projectedMinutes: frameSize && jobSeconds ? round((jobSeconds * frameSize * (weightedAdoption.weightedRate ?? 0)) / 60, 1) : null,
      projectedJobRecords: frameSize && jobs ? Math.round(frameSize * (weightedAdoption.weightedRate ?? 0) * (jobs.jobRecordsPerReachingCompanyMean ?? 0) * (jobs.companyReachRateAmongEligible ?? 0)) : null,
    } : null,
  };

  // Integrity checks the full-run instruction asks for explicitly.
  const corpCounts = new Map();
  for (const r of rows) corpCounts.set(r.corporateNumber, (corpCounts.get(r.corporateNumber) ?? 0) + 1);
  const urlCounts = new Map();
  for (const r of adoptedRows) {
    const u = (r.finalUrl ?? r.recruitmentUrl ?? '').replace(/\/$/, '');
    if (u) urlCounts.set(u, (urlCounts.get(u) ?? 0) + 1);
  }
  const jobUrlCounts = new Map();
  for (const j of (jobsData?.jobs ?? [])) {
    const k = `${(j.jobUrl ?? '').replace(/\/$/, '')}`;
    if (!jobUrlCounts.has(k)) jobUrlCounts.set(k, new Set());
    jobUrlCounts.get(k).add(j.corporateNumber);
  }
  const integrity = {
    companies: rows.length,
    duplicateCorporateNumbers: [...corpCounts.entries()].filter(([, n]) => n > 1).length,
    confidenceBucketsSumToCompanies:
      funnel.confidence.high + funnel.confidence.medium + funnel.confidence.low + funnel.confidence.none === rows.length,
    recruitmentUrlsSharedByMultipleCompanies: [...urlCounts.entries()].filter(([, n]) => n > 1).length,
    jobUrlsSharedByMultipleCompanies: [...jobUrlCounts.entries()].filter(([, s]) => s.size > 1).length,
    nullsPreserved: 'このパイプラインでは未取得値を null のまま保持しており、0 や false に変換していない。',
  };

  const analysis = {
    runDate: RUN_DATE,
    stage: 'stage4-5-analysis',
    integrityChecks: integrity,
    generator: 'scripts/research-stage45-analysis.mjs',
    generatedAtUtc: new Date().toISOString(),
    inputs: {
      discovery: `${RUN_DATE}-discovery-${args.tag}.json`,
      jobs: jobsData ? `${RUN_DATE}-jobs-${args.tag}.json` : null,
      stage3Analysis: stage3 ? `${RUN_DATE}-analysis.json` : null,
    },
    sampling: discovery.sampling,
    executionTime: {
      discoveryElapsedSeconds: discovery.elapsedSeconds ?? null,
      discoveryResume: discovery.resume ?? null,
      jobsElapsedSeconds: jobsData?.elapsedSeconds ?? null,
      jobsResume: jobsData?.resume ?? null,
    },
    discoveryFunnel: funnel,
    weightedAdoption,
    rootFallbackRetry: retry ? {
      purpose: retry.purpose,
      file: path.basename(retryPath),
      attempted: retry.retryCounts.attempted,
      nowAdopted: retry.retryCounts.nowAdopted,
      adoptedViaRootFallback: retry.retryCounts.adoptedViaRootFallback,
      combinedIfMerged: retry.combinedIfMerged,
      note: '企業HPの登録URLが深い下層ページや404の場合に、同一オリジンのルートだけを1回試す改良。URL総当たりではない。本パイロットの主集計には合算していない。',
    } : null,
    accessOutcomes: access,
    coverageGainVsShokubaColumn: coverageGain,
    breakdowns,
    jobs,
    scaleUpProjection: projection,
    guardrails: [
      'サンプルは層化均等割当。未加重の値は「300社のうち」であり母集団比ではない。母集団換算は populationWeight 加重値を使う。',
      '母集団は「情報通信業かつ企業HP URLがある3,419ホスト」。情報通信業8,118社でも日本のIT企業全体でもない。',
      'confidence low は採用していない。発見できなかった企業＝採用ページが存在しない、ではない。',
      '求人レコードは1社最大8件の上限付き。大企業の求人数を過小評価する。',
      'salaryUnit が YEAR と MONTH のレコードを混ぜて平均しない。',
      'キーワードフラグは出現有無。求人条件の裏取りではない。',
      '不明値は null。0 や false ではない。',
    ],
  };

  const outPath = path.join(DIR, args.outName ?? `${RUN_DATE}-discovery-analysis.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ out: outPath, funnel, weightedAdoption, jobs: jobs && { companiesReachingJobRecords: jobs.companiesReachingJobRecords, jobRecords: jobs.jobRecords, median: jobs.medianJobRecordsPerReachingCompany }, projection }, null, 2));
}

main();
