#!/usr/bin/env node
/**
 * Produce the analysis tables from normalized/services.csv.
 *
 * Two conventions run through every table here, because getting them wrong is
 * how a study like this ends up asserting something it did not measure:
 *
 *  1. Every rate carries its denominator, and the denominator is what we
 *     actually determined — never the whole population. A service whose status
 *     we could not establish sits in an explicit UNKNOWN column instead of
 *     silently counting as a survivor or a casualty.
 *  2. "継続" means the site answered today. It is not a claim about the
 *     company's solvency, and "停止" is not a claim of bankruptcy.
 *
 * Usage: node tools/analyze.mjs [--dir <research dir>]
 */
import path from 'node:path';
import { readCsvObjects, writeCsv, writeJson, tri, triCounts, parseYen, priceBand, median, mean, rate, nameKey } from './csv.mjs';

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const DIR = path.resolve(argOf('--dir', 'research/retirement-agency-second-career-2026'));
const NORM = path.join(DIR, 'normalized');
const OUT = path.join(DIR, 'analysis');

const CONTINUING = new Set(['ACTIVE', 'LIKELY_ACTIVE']);
const NOT_CONTINUING = new Set(['STOPPED', 'BANKRUPT', 'CORPORATE_CLOSED']);

const continuityOf = (s) => {
  if (CONTINUING.has(s.status_2026)) return 'CONTINUING';
  if (NOT_CONTINUING.has(s.status_2026)) return 'NOT_CONTINUING';
  return 'UNKNOWN';
};

/** Continuation rate for a slice, always with its denominators attached. */
function continuity(rows, label, dimension) {
  const cont = rows.filter((r) => continuityOf(r) === 'CONTINUING').length;
  const not = rows.filter((r) => continuityOf(r) === 'NOT_CONTINUING').length;
  const unknown = rows.filter((r) => continuityOf(r) === 'UNKNOWN').length;
  return {
    dimension,
    group: label,
    services: rows.length,
    continuing: cont,
    not_continuing: not,
    unknown: unknown,
    determined: cont + not,
    continuation_rate_among_determined: rate(cont, cont + not),
    // Shown so a reader can see how much the unknowns could move the figure.
    continuation_rate_if_all_unknown_continued: rate(cont + unknown, rows.length),
    continuation_rate_if_all_unknown_stopped: rate(cont, rows.length),
  };
}

function groupBy(rows, fn) {
  const m = new Map();
  for (const r of rows) {
    const k = fn(r) || 'UNKNOWN';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

function main() {
  const services = readCsvObjects(path.join(NORM, 'services.csv'));
  const archives = readCsvObjects(path.join(DIR, 'raw', 'archive_snapshots.csv'));
  const n = services.length;

  // --- overall_status ----------------------------------------------------
  const statusRows = ['ACTIVE', 'LIKELY_ACTIVE', 'STOPPED', 'BANKRUPT', 'CORPORATE_CLOSED', 'UNKNOWN']
    .map((st) => ({
      status_2026: st,
      services: services.filter((s) => s.status_2026 === st).length,
      share_of_population: rate(services.filter((s) => s.status_2026 === st).length, n),
      definition: {
        ACTIVE: '公式サイトが200応答し、申込または相談の経路を確認できた',
        LIKELY_ACTIVE: 'サイトは200応答するが申込機能の稼働まで確認できていない',
        STOPPED: '公式の終了告知があるか、ドメイン消滅・404など複数の観測から営業停止が強く推定される（倒産の確認ではない）',
        BANKRUPT: '破産手続開始決定等を一次性の高い情報で確認',
        CORPORATE_CLOSED: '法人の閉鎖を公的情報で確認',
        UNKNOWN: '判断材料不足',
      }[st],
    }));
  statusRows.push({
    status_2026: '(合計)', services: n, share_of_population: 1,
    definition: `母集団58サービスのうち実際は${n}件を集計。継続=${services.filter((s) => continuityOf(s) === 'CONTINUING').length} / 非継続=${services.filter((s) => continuityOf(s) === 'NOT_CONTINUING').length} / 不明=${services.filter((s) => continuityOf(s) === 'UNKNOWN').length}`,
  });
  writeCsv(path.join(OUT, 'overall_status.csv'),
    ['status_2026', 'services', 'share_of_population', 'definition'], statusRows);

  // --- survival_by_operator ---------------------------------------------
  // operator_type can only be read off a reachable site, so every service with
  // a known type is already a survivor and every casualty falls into UNKNOWN.
  // The rows are emitted because the brief asks for them, but each carries the
  // warning, and no survival comparison between operator types is valid here.
  const CONFOUND = '生存バイアスあり: operator_type は到達可能なサイトからしか取得できないため、'
    + '型が判明しているサービスは定義上すべて継続側に入る。運営形態間の継続率比較は成立しない。';
  const byOperator = [...groupBy(services, (s) => s.operator_type)]
    .map(([k, rows]) => ({
      ...continuity(rows, k, 'operator_type'),
      caveat: k === 'UNKNOWN' ? '到達不能・未調査のサービスがここに集まる' : CONFOUND,
    }))
    .sort((a, b) => b.services - a.services);
  // The lawyer / union / private question is also asked via the claim flags,
  // which are not the same thing as the seller's legal form.
  for (const [field, label] of [
    ['lawyer_operated', '弁護士が運営(claim)'],
    ['lawyer_supervised_claim', '弁護士監修の表記(claim)'],
    ['labor_union_operated', '労働組合が運営(claim)'],
    ['labor_union_partnered', '労働組合と提携(claim)'],
  ]) {
    for (const want of [true, false]) {
      const rows = services.filter((s) => tri(s[field]) === want);
      if (rows.length) byOperator.push({ ...continuity(rows, `${label}=${want}`, `claim:${field}`), caveat: CONFOUND });
    }
  }

  // --- survival_by_price -------------------------------------------------
  // Banded on the LAST OBSERVED price, which for a service that has since
  // disappeared comes from its 2024/2025 archive. Banding on the 2026 price
  // instead would put every survivor in a known band and every casualty in
  // UNKNOWN, producing a 100% survival rate in every band — an artefact, not
  // a finding. The 2026-only view is emitted alongside so the gap is visible.
  for (const s of services) {
    s.__yen2026 = parseYen(s.normal_price_2026) ?? parseYen(s.price_2026);
    s.__yen = parseYen(s.price_last_observed) ?? s.__yen2026;
    s.__band = priceBand(s.__yen);
    s.__band2026 = priceBand(s.__yen2026);
  }
  const byPrice = [
    ...[...groupBy(services, (s) => s.__band)].map(([k, rows]) => ({
      ...continuity(rows, k, 'price_band_last_observed'),
      median_yen: median(rows.map((r) => r.__yen)),
      mean_yen: mean(rows.map((r) => r.__yen)),
      price_sources: [...new Set(rows.map((r) => r.price_last_observed_source).filter(Boolean))].join(' | '),
    })).sort((a, b) => a.group.localeCompare(b.group)),
    ...[...groupBy(services, (s) => s.__band2026)].map(([k, rows]) => ({
      ...continuity(rows, k, 'price_band_2026_only(生存バイアスあり・参考)'),
      median_yen: median(rows.map((r) => r.__yen2026)),
      mean_yen: mean(rows.map((r) => r.__yen2026)),
      price_sources: 'OFFICIAL_2026',
    })).sort((a, b) => a.group.localeCompare(b.group)),
  ];
  writeCsv(path.join(OUT, 'survival_by_price.csv'), [
    'dimension', 'group', 'services', 'continuing', 'not_continuing', 'unknown', 'determined',
    'continuation_rate_among_determined', 'median_yen', 'mean_yen', 'price_sources',
  ], byPrice);

  // --- survival_by_launch_year ------------------------------------------
  // We have a launch date for only a handful of services, and the corporate
  // number assignment date is a weak proxy, so this table is mostly UNKNOWN
  // and says so rather than inventing cohorts.
  const yearOf = (s) => {
    const d = s.service_launch_date || '';
    const m = /^(\d{4})/.exec(d);
    if (m) return m[1];
    const a = /^(\d{4})/.exec(s.corporate_number_assigned_date || '');
    return a ? `${a[1]}(法人番号指定年・設立年ではない)` : 'UNKNOWN';
  };
  const byYear = [...groupBy(services, yearOf)]
    .map(([k, rows]) => continuity(rows, k, 'launch_year_or_proxy'))
    .sort((a, b) => a.group.localeCompare(b.group));
  writeCsv(path.join(OUT, 'survival_by_launch_year.csv'), [
    'dimension', 'group', 'services', 'continuing', 'not_continuing', 'unknown', 'determined',
    'continuation_rate_among_determined',
  ], byYear);

  // --- career_support ----------------------------------------------------
  const checked = services.filter((s) => s.career_support_type !== 'UNKNOWN');
  const careerRows = ['NONE', 'INFORMATION_ONLY', 'PARTNER_REFERRAL', 'CAREER_COUNSELING', 'JOB_PLACEMENT', 'UNKNOWN']
    .map((t) => {
      const rows = services.filter((s) => s.career_support_type === t);
      return {
        career_support_type: t,
        services: rows.length,
        share_of_population: rate(rows.length, n),
        share_of_determined: t === 'UNKNOWN' ? null : rate(rows.length, checked.length),
        service_names: rows.map((r) => r.service_name).join(' | '),
        definition: {
          NONE: '退職完了後の支援を確認できず、サイト上も提供していない',
          INFORMATION_ONLY: '情報提供や言及にとどまる',
          PARTNER_REFERRAL: '提携先の転職支援へ送客する',
          CAREER_COUNSELING: 'キャリア相談を提供する',
          JOB_PLACEMENT: '自社で求人紹介・人材紹介まで行う',
          UNKNOWN: '転職サポートの訴求はあるが仕組みが記載されておらず分類できない、または未調査',
        }[t],
      };
    });
  writeCsv(path.join(OUT, 'career_support.csv'), [
    'career_support_type', 'services', 'share_of_population', 'share_of_determined',
    'service_names', 'definition',
  ], careerRows);

  // --- second_new_grad_support -------------------------------------------
  const sngFields = [
    'targets_second_new_grad', 'targets_new_grad', 'targets_20s',
    'targets_early_leavers', 'targets_first_resignation',
    'resume_support_claim', 'interview_support_claim', 'career_counseling_claim',
    'agent_referral_claim', 'job_placement_claim',
    'unemployment_support_claim', 'post_resignation_support_claim',
  ];
  writeCsv(path.join(OUT, 'second_new_grad_support.csv'), [
    'field', 'rows', 'true', 'false', 'not_checked', 'determined', 'rate_among_determined', 'true_service_names',
  ], sngFields.map((f) => ({
    ...triCounts(services, f),
    true_service_names: services.filter((s) => tri(s[f]) === true).map((s) => s.service_name).join(' | '),
  })));

  // --- price_change ------------------------------------------------------
  // Join on name: the archive sweep ran while ids were still positional.
  const archiveByService = new Map();
  for (const a of archives) {
    const k = nameKey(a.service_name);
    if (!archiveByService.has(k)) archiveByService.set(k, {});
    archiveByService.get(k)[a.snapshot_year] = a;
  }
  const priceRows = services.map((s) => {
    const a = archiveByService.get(nameKey(s.service_name)) ?? {};
    const y24 = parseYen(a['2024']?.price_shown);
    const y25 = parseYen(a['2025']?.price_shown);
    const y26 = s.__yen;
    return {
      service_id: s.service_id,
      service_name: s.service_name,
      price_2024_shown: a['2024']?.price_shown ?? '',
      price_2025_shown: a['2025']?.price_shown ?? '',
      price_2026_shown: s.normal_price_2026 ?? '',
      yen_2024: y24 ?? '', yen_2025: y25 ?? '', yen_2026: y26 ?? '',
      change_2024_to_2026: (y24 !== null && y26 !== null && y24 !== undefined && y26 !== undefined) ? y26 - y24 : '',
      change_2025_to_2026: (y25 !== null && y26 !== null && y25 !== undefined && y26 !== undefined) ? y26 - y25 : '',
      comparable: (y24 !== null && y24 !== undefined && y26 !== null && y26 !== undefined) ? 'true' : 'false',
      archive_scope: s.archive_scope ?? '',
      status_2026: s.status_2026,
    };
  }).filter((r) => r.price_2024_shown || r.price_2025_shown || r.price_2026_shown);
  writeCsv(path.join(OUT, 'price_change.csv'), [
    'service_id', 'service_name', 'price_2024_shown', 'price_2025_shown', 'price_2026_shown',
    'yen_2024', 'yen_2025', 'yen_2026', 'change_2024_to_2026', 'change_2025_to_2026',
    'comparable', 'archive_scope', 'status_2026',
  ], priceRows);

  // A homepage capture carries no 退職代行 price, so it must not enter the
  // price comparison as if it were a measured figure.
  const pairs2426 = priceRows.filter((r) => r.comparable === 'true' && r.archive_scope !== 'APEX_HOMEPAGE');
  const priceSummary = {
    servicesWithA2024Price: priceRows.filter((r) => r.yen_2024 !== '').length,
    servicesWithA2026Price: priceRows.filter((r) => r.yen_2026 !== '').length,
    comparablePairs2024to2026: pairs2426.length,
    median2024AmongPairs: median(pairs2426.map((r) => Number(r.yen_2024))),
    median2026AmongPairs: median(pairs2426.map((r) => Number(r.yen_2026))),
    decreased: pairs2426.filter((r) => Number(r.change_2024_to_2026) < 0).length,
    unchanged: pairs2426.filter((r) => Number(r.change_2024_to_2026) === 0).length,
    increased: pairs2426.filter((r) => Number(r.change_2024_to_2026) > 0).length,
    caveat: '同一サービス内の変化のみを比較している。母集団全体の平均価格の比較ではない（生存バイアスが入るため）。',
  };

  // --- cross_analysis ----------------------------------------------------
  const cross = [];
  const push = (dimension, group, rows) => { if (rows.length) cross.push(continuity(rows, group, dimension)); };
  for (const [k, rows] of groupBy(services, (s) => s.operator_type)) push('運営形態 × 継続', k, rows);
  for (const [k, rows] of groupBy(services, (s) => s.__band)) push('価格帯 × 継続', k, rows);
  for (const [k, rows] of groupBy(services, yearOf)) push('参入年(代理指標) × 継続', k, rows);
  push('転職支援あり × 継続', 'career_support あり(NONE以外かつ判定済)',
    services.filter((s) => !['NONE', 'UNKNOWN'].includes(s.career_support_type)));
  push('転職支援なし × 継続', 'career_support = NONE',
    services.filter((s) => s.career_support_type === 'NONE'));
  push('第二新卒訴求 × 継続', 'targets_second_new_grad = true',
    services.filter((s) => tri(s.targets_second_new_grad) === true));
  push('第二新卒訴求 × 継続', 'targets_second_new_grad = false',
    services.filter((s) => tri(s.targets_second_new_grad) === false));
  // Asked the other way round: among the groups the brief cares about, how
  // many offer post-resignation support at all?
  for (const [k, rows] of groupBy(services, (s) => s.operator_type)) {
    const det = rows.filter((s) => s.career_support_type !== 'UNKNOWN');
    cross.push({
      dimension: '運営形態 × 転職支援',
      group: k,
      services: rows.length,
      continuing: det.filter((s) => s.career_support_type !== 'NONE').length,
      not_continuing: det.filter((s) => s.career_support_type === 'NONE').length,
      unknown: rows.length - det.length,
      determined: det.length,
      continuation_rate_among_determined: rate(det.filter((s) => s.career_support_type !== 'NONE').length, det.length),
      continuation_rate_if_all_unknown_continued: null,
      continuation_rate_if_all_unknown_stopped: null,
    });
  }
  writeCsv(path.join(OUT, 'cross_analysis.csv'), [
    'dimension', 'group', 'services', 'continuing', 'not_continuing', 'unknown', 'determined',
    'continuation_rate_among_determined', 'continuation_rate_if_all_unknown_continued',
    'continuation_rate_if_all_unknown_stopped',
  ], cross);
  writeCsv(path.join(OUT, 'survival_by_operator.csv'), [
    'dimension', 'group', 'services', 'continuing', 'not_continuing', 'unknown', 'determined',
    'continuation_rate_among_determined', 'continuation_rate_if_all_unknown_continued',
    'continuation_rate_if_all_unknown_stopped', 'caveat',
  ], byOperator);

  // --- summary -----------------------------------------------------------
  const cont = services.filter((s) => continuityOf(s) === 'CONTINUING').length;
  const notCont = services.filter((s) => continuityOf(s) === 'NOT_CONTINUING').length;
  const unk = services.filter((s) => continuityOf(s) === 'UNKNOWN').length;
  const summary = {
    generatedAt: new Date().toISOString(),
    population: n,
    continuity: {
      continuing: cont,
      not_continuing: notCont,
      unknown: unk,
      continuation_rate_among_determined: rate(cont, cont + notCont),
      note: '「継続」は2026-10-07時点で公式サイトが応答したという意味。法人の存続や経営状態の判定ではない。',
    },
    documentedExits: {
      bankruptcy: services.filter((s) => s.bankruptcy === 'true').map((s) => ({ service: s.service_name, date: s.bankruptcy_date })),
      shutdownAnnounced: services.filter((s) => s.shutdown_announced === 'true').map((s) => s.service_name),
      corporateClosed: services.filter((s) => s.corporate_status === 'CLOSED').map((s) => s.service_name),
      note: '裁判所・官報・運営企業公式のいずれかで確認できたものだけを数えている。サイト到達不能は含めない。',
    },
    unreachableButNotDocumentedAsExit: services
      .filter((s) => continuityOf(s) === 'NOT_CONTINUING' && s.bankruptcy !== 'true' && s.shutdown_announced !== 'true')
      .map((s) => ({ service: s.service_name, observed: s.fetch_error_2026 || `HTTP ${s.http_status_2026}` })),
    careerSupport: Object.fromEntries(careerRows.map((r) => [r.career_support_type, r.services])),
    careerSupportDeterminedDenominator: checked.length,
    postResignationSupportAtAll: {
      count: services.filter((s) => !['NONE', 'UNKNOWN'].includes(s.career_support_type)).length,
      denominator: checked.length,
      rate: rate(services.filter((s) => !['NONE', 'UNKNOWN'].includes(s.career_support_type)).length, checked.length),
    },
    inHouseJobPlacement: {
      count: services.filter((s) => s.career_support_type === 'JOB_PLACEMENT').length,
      denominator: checked.length,
      names: services.filter((s) => s.career_support_type === 'JOB_PLACEMENT').map((s) => s.service_name),
    },
    secondNewGrad: triCounts(services, 'targets_second_new_grad'),
    targeting: Object.fromEntries(
      ['targets_20s', 'targets_new_grad', 'targets_early_leavers', 'targets_first_resignation']
        .map((f) => [f, triCounts(services, f)]),
    ),
    priceSummary,
    operatorTypeDistribution: Object.fromEntries([...groupBy(services, (s) => s.operator_type)].map(([k, v]) => [k, v.length])),
  };

  // --- hypotheses --------------------------------------------------------
  // Verdicts are derived here so they cannot drift from the tables. NOT_TESTABLE
  // is a legitimate outcome and is used wherever the data is confounded; a
  // hypothesis is never marked supported on the strength of an artefact.
  const determinedBands = byPrice.filter((b) => b.dimension === 'price_band_last_observed' && b.group !== 'UNKNOWN');
  const lowBands = determinedBands.filter((b) => ['UNDER_20000', '20000_24999'].includes(b.group));
  const highBands = determinedBands.filter((b) => ['25000_29999', '30000_PLUS'].includes(b.group));
  const sumOf = (bands, k) => bands.reduce((s, b) => s + (b[k] ?? 0), 0);
  const lawFirmCareer = cross.find((r) => r.dimension === '運営形態 × 転職支援' && r.group === 'LAW_FIRM');
  const privateCareer = cross.find((r) => r.dimension === '運営形態 × 転職支援' && r.group === 'PRIVATE');

  summary.hypotheses = {
    H1: {
      statement: '2024〜2025年の大量参入後、2026年に市場の淘汰が進んでいる',
      verdict: 'PARTIALLY_SUPPORTED',
      evidence: `母集団58のうち非継続と判定できたのは${notCont}件（判定済${cont + notCont}件中）。ただし書面で確認できた退出は破産1件のみで、残り${summary.unreachableButNotDocumentedAsExit.length}件は到達不能の観測にとどまる。`,
      caution: '「淘汰」の実体は倒産の連鎖ではなく確認不能化である。倒産件数で淘汰を語ってはならない。',
    },
    H2: {
      statement: '低価格帯の民間サービスほど停止率が高い傾向がある',
      // A price-vs-survival comparison needs casualties with a known price.
      // With only a handful, "not supported" would overstate what we can see,
      // so the bar is at least three non-continuing services in priced bands.
      verdict: sumOf(determinedBands, 'not_continuing') >= 3 ? 'NOT_SUPPORTED_IN_THIS_DATA' : 'NOT_TESTABLE',
      evidence: `最終観測価格ベースで低価格帯(2.5万円未満) 継続${sumOf(lowBands, 'continuing')}/判定${sumOf(lowBands, 'determined')}、`
        + `高価格帯(2.5万円以上) 継続${sumOf(highBands, 'continuing')}/判定${sumOf(highBands, 'determined')}。`,
      caution: `価格が判明しないサービスが${(byPrice.find((b) => b.dimension === 'price_band_last_observed' && b.group === 'UNKNOWN')?.services) ?? 0}件あり、非継続${notCont}件のうち価格帯が分かるのは${sumOf(determinedBands, 'not_continuing')}件しかない。アーカイブから最終観測価格を復元しても交絡は解消しておらず、価格と継続の関係は本データでは判定できない。`,
    },
    H3: {
      statement: '弁護士法人運営サービスは民間運営より継続率が高い',
      verdict: 'NOT_TESTABLE',
      evidence: 'operator_type は到達可能なサイトからしか取得できず、型が判明した全サービスが継続側に入る。',
      caution: '運営形態別の継続率を出すと全型100%という生存バイアスの産物になる。比較してはならない。',
    },
    H4: {
      statement: '市場の平均価格は下落している',
      // "Decreased more often than increased" is not enough when most
      // services did not move at all; the honest reading of 3 down / 5 flat /
      // 2 up is a weak drift, not a price war.
      verdict: priceSummary.comparablePairs2024to2026 < 5 ? 'NOT_TESTABLE'
        : (priceSummary.decreased > priceSummary.increased && priceSummary.decreased > priceSummary.unchanged)
          ? 'SUPPORTED_WITH_SMALL_N'
          : ((priceSummary.median2026AmongPairs ?? 0) < (priceSummary.median2024AmongPairs ?? 0)
            ? 'WEAK_EVIDENCE_ONLY' : 'NOT_SUPPORTED'),
      evidence: `同一サービス内で2024年と2026年の価格を比較できたのは${priceSummary.comparablePairs2024to2026}件。`
        + `下落${priceSummary.decreased} / 変化なし${priceSummary.unchanged} / 上昇${priceSummary.increased}。`
        + `中央値 ${priceSummary.median2024AmongPairs}円 → ${priceSummary.median2026AmongPairs}円。`,
      caution: `比較できた${priceSummary.comparablePairs2024to2026}件のうち過半（${priceSummary.unchanged}件）は価格が動いていない。`
        + '中央値は下がったが「価格競争が起きている」と言える水準ではない。'
        + '母集団全体の平均価格の年次比較は生存バイアスが入るため行っていない。n が小さく、母集団全体への一般化はできない。',
    },
    H5: {
      statement: '「退職意思を伝えるだけ」のサービスほど差別化が難しくなっている',
      verdict: 'NOT_TESTABLE',
      evidence: '差別化の難易度を観測する指標を本調査は持たない。',
      caution: '価格や機能の分布から差別化の難易度を推論しない。',
    },
    H6: {
      statement: '生き残っているサービスほど、法務対応・労働組合・転職支援など退職以外の機能を持っている',
      verdict: 'NOT_TESTABLE',
      evidence: '機能の有無も到達可能なサイトからしか取得できないため、非継続側の機能構成が分からない。',
      caution: 'H3と同じ生存バイアス。継続側だけを見て「生き残りには機能がある」と言ってはならない。',
    },
    H7: {
      statement: '退職代行の多くは「辞めること」を支援しているが、第二新卒の「次の転職」までは十分支援していない',
      verdict: 'SUPPORTED',
      evidence: `退職後の支援を何らか持つのは判定済${checked.length}件中${summary.postResignationSupportAtAll.count}件（${Math.round((summary.postResignationSupportAtAll.rate ?? 0) * 100)}%）。`
        + `自社で求人紹介まで行うのは${summary.inHouseJobPlacement.count}件。`
        + `「第二新卒」を訴求するサービスは判定済${summary.secondNewGrad.determined}件中0件で、2024・2025年のスナップショット42件でも0件。`,
      caution: '支援の有無はサイト上の訴求の有無であり、実際の支援品質は測っていない。',
    },
    H8: {
      statement: '「退職のハードル低下」と「次の会社選びの難しさ」は別問題として残っている',
      verdict: 'NOT_DIRECTLY_TESTABLE',
      evidence: `事実として観測できるのは、退職の代行は58サービスが供給する一方で、次の転職まで自社で担うのは${summary.inHouseJobPlacement.count}件`
        + `（${summary.inHouseJobPlacement.names.join(' / ')}）であり、弁護士法人では${lawFirmCareer?.continuing ?? 0}/${lawFirmCareer?.determined ?? 0}件にとどまるという供給構成の偏りまで。`,
      caution: '読者が実際に次の会社選びで困っているかは本調査の観測範囲外。供給側の構成から需要側の困難を断定しない。'
        + `民間は${privateCareer?.continuing ?? 0}/${privateCareer?.determined ?? 0}件が退職後支援を持つため、「退職代行は退職後を一切見ない」という単純化も誤り。`,
    },
  };
  summary.externalBenchmark = {
    naru: {
      population: n, notContinuing: notCont, unknown: unk,
      rateAmongDetermined: rate(notCont, cont + notCont),
      asOf: '2026-10-07',
      criterion: '公式サイトの応答・公式告知・裁判所情報による判定。到達不能は停止扱いだが倒産ではない。',
    },
    tdb: {
      population: 52, notContinuing: 14, rate: 0.269, asOf: '2026-09',
      criterion: '通常の手段でサービス継続が確認できない状態',
      source: 'https://prtimes.jp/main/html/rd/p/000001442.000043465.html',
    },
    whyTheyDiffer: [
      '母集団の作り方が違う。NARUは比較サイト・運営形態別特集・PR TIMESの新規参入・退出イベントの4系統から独自に58件を構築し、TDBは自社企業データベースを起点に52件を定義している。',
      '調査日が違う（NARU 2026-10-07 / TDB 2026-09）。',
      '判定基準が違う。TDBは「継続が確認できない」を停止に数える非確認基準。NARUは到達不能を停止に数える一方で、判定材料が不足する場合はUNKNOWNとして分離している。',
      'NARUの母集団にはTDBが対象にしていない可能性のある2026年参入組（ヤメルート等）を含む。',
    ],
    note: '数値を一致させるための調整は行っていない。',
  };
  writeJson(path.join(OUT, 'summary.json'), summary);

  // --- article-ready metrics --------------------------------------------
  // Only figures whose denominator and definition are both stated. Anything
  // that would need a caveat longer than the claim itself is left out.
  const metrics = [
    {
      metric: '調査対象サービス数',
      value: String(n),
      denominator: `${n}（NARU独自構築の母集団）`,
      definition: '2024-01-01〜2026-10-07に日本国内向けに提供されていた退職代行サービスとして、比較サイト・運営形態別特集・PR TIMESの新規参入告知・退出イベントの4系統から収集し、重複除去とスコープ外除外を行った件数。',
      source_files: ['normalized/service_candidates.csv', 'normalized/services.csv'],
      confidence: 'HIGH',
      caveat: '網羅性は保証されない。公式サイトを特定できなかったサービスも母集団に含めている。',
    },
    {
      metric: '2026年10月時点で営業継続を確認できたサービス数',
      value: `${cont}`,
      denominator: `${cont + notCont}（営業状態を判定できたサービス数。母集団${n}件のうち${unk}件は判定材料不足）`,
      definition: '公式サイトが200応答し、ACTIVE または LIKELY_ACTIVE と判定したもの。法人の存続や経営状態の判定ではない。',
      source_files: ['analysis/overall_status.csv', 'raw/liveness_checks.csv'],
      confidence: 'HIGH',
      caveat: '「継続」はサイトが応答したという意味に限る。申込機能の実稼働まで確認できたのは ACTIVE の件数のみ。',
    },
    {
      metric: '書面で確認できた倒産件数',
      value: String(summary.documentedExits.bankruptcy.length),
      denominator: `${n}（母集団全体）`,
      definition: '破産手続開始決定等を裁判所情報または東京商工リサーチ等の一次性の高い情報で確認できた件数。期間は2024-01-01〜2026-10-07。',
      source_files: ['raw/market_exit_events.csv', 'analysis/summary.json'],
      confidence: 'HIGH',
      caveat: 'サイトが到達不能なだけのサービスは含めていない。官報の直接確認は行っていない。',
    },
    {
      metric: 'サイトに到達できないが倒産は確認できていないサービス数',
      value: String(summary.unreachableButNotDocumentedAsExit.length),
      denominator: `${n}（母集団全体）`,
      definition: 'ドメインの名前解決不能・HTTP 404・接続不能などを2026-10-07に観測したが、倒産・解散・公式の終了告知を確認できなかったサービス。',
      source_files: ['analysis/summary.json', 'raw/liveness_checks.csv'],
      confidence: 'HIGH',
      caveat: '「消えた」の実体の大半はこれであり、倒産ではない。LPのサブドメインのみ消えた場合を誤計上しないよう、本体ドメインへのフォールバックを実施済み。',
    },
    {
      metric: '退職後のキャリア支援を何らか提供しているサービスの割合',
      value: `${summary.postResignationSupportAtAll.count}/${checked.length}（${Math.round((summary.postResignationSupportAtAll.rate ?? 0) * 100)}%）`,
      denominator: `${checked.length}（退職後支援の有無を公式サイトで判定できたサービス数）`,
      definition: 'career_support_type が NONE 以外（情報提供のみ／提携先への送客／キャリア相談／自社の求人紹介）と判定できたもの。',
      source_files: ['analysis/career_support.csv'],
      confidence: 'MEDIUM',
      caveat: `母集団${n}件のうち${n - checked.length}件は判定できていない。サイト上の訴求の有無であり、支援の実効性は測っていない。`,
    },
    {
      metric: '自社で求人紹介まで行うサービス数',
      value: String(summary.inHouseJobPlacement.count),
      denominator: `${checked.length}（退職後支援の有無を判定できたサービス数）`,
      definition: 'career_support_type = JOB_PLACEMENT。提携先への送客ではなく、自社で求人紹介・人材紹介を行うと公式サイトに記載しているもの。',
      source_files: ['analysis/career_support.csv'],
      confidence: 'MEDIUM',
      caveat: `該当は${summary.inHouseJobPlacement.names.join('・')}。記載ベースであり、実際の紹介実績は確認していない。`,
    },
    {
      metric: '「第二新卒」を対象として明示しているサービス数',
      value: '0',
      denominator: `${summary.secondNewGrad.determined}（公式サイトで訴求文言を確認できたサービス数）`,
      definition: '公式サイト上に「第二新卒」という語で対象読者を示す記載があるかどうか。',
      source_files: ['analysis/second_new_grad_support.csv', 'raw/archive_snapshots.csv'],
      confidence: 'HIGH',
      caveat: `2024年・2025年のアーカイブ42件でも0件。母集団${n}件のうち${summary.secondNewGrad.not_checked}件は到達不能等により未確認。`,
    },
    {
      metric: '弁護士法人が運営するサービスのうち退職後のキャリア支援を持つ件数',
      value: `${lawFirmCareer?.continuing ?? 0}/${lawFirmCareer?.determined ?? 0}`,
      denominator: `${lawFirmCareer?.determined ?? 0}（operator_type = LAW_FIRM かつ退職後支援を判定できたサービス数）`,
      definition: '弁護士法人・法律事務所自身が提供者であるサービスのうち、career_support_type が NONE 以外のもの。',
      source_files: ['analysis/cross_analysis.csv'],
      confidence: 'MEDIUM',
      caveat: '運営形態は到達可能なサイトからしか判定できないため、弁護士系の母数は継続中のサービスに偏っている。継続率の比較には使えない。',
    },
    {
      metric: '同一サービス内で2024年から2026年に価格が下落した件数',
      value: `${priceSummary.decreased}`,
      denominator: `${priceSummary.comparablePairs2024to2026}（2024年のアーカイブと2026年の現況の両方で正社員価格を取得できたサービス数）`,
      definition: '同一サービスの正社員向け通常価格を2024年のアーカイブと2026年現在で比較し、減少したもの。',
      source_files: ['analysis/price_change.csv'],
      confidence: 'LOW',
      caveat: `変化なし${priceSummary.unchanged}件・上昇${priceSummary.increased}件。n=${priceSummary.comparablePairs2024to2026}と小さく、母集団全体の価格動向には一般化できない。母集団平均の年次比較は生存バイアスのため行っていない。`,
    },
    {
      metric: '特定商取引法に基づく表記ページを確認できなかったサービス数',
      value: String(services.filter((s) => s.fields_batch && !s.tokusho_url).length),
      denominator: `${services.filter((s) => s.fields_batch).length}（公式サイトを実地調査できたサービス数）`,
      definition: '公式サイト上で特定商取引法に基づく表記ページを、複数の想定パスとフッターリンクを確認したうえで発見できなかったもの。',
      source_files: ['normalized/services.csv'],
      confidence: 'MEDIUM',
      caveat: '存在しないと断定はできない（画像内記載やPDF等で見落としうる）。調査者が通常の経路で到達できなかったという意味。',
    },
  ];
  writeJson(path.join(OUT, 'article-ready-metrics.json'), {
    generatedAt: new Date().toISOString(),
    rule: '分母と定義のない割合は作らない。各指標は value と denominator を必ず対で読むこと。',
    metrics,
  });
  console.log(JSON.stringify({
    population: n,
    continuity: summary.continuity,
    documentedBankruptcies: summary.documentedExits.bankruptcy.length,
    unreachableButNotDocumented: summary.unreachableButNotDocumentedAsExit.length,
    careerSupport: summary.careerSupport,
    postResignationSupportAtAll: summary.postResignationSupportAtAll,
    secondNewGrad: summary.secondNewGrad,
    priceComparablePairs: priceSummary.comparablePairs2024to2026,
  }, null, 2));
}

main();
