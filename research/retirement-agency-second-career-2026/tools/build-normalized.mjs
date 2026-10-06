#!/usr/bin/env node
/**
 * Build normalized/services.csv, operators.csv and evidence.csv from the raw
 * sweeps, then decide each service's 2024 / 2025 / 2026 status.
 *
 * The status call is the part most likely to be wrong in a way that matters,
 * so it is made here, once, from explicit rules rather than per-agent
 * judgement. Two rules carry most of the weight:
 *
 *  - An unreachable site is never a bankruptcy. DNS failure, 404, TLS error
 *    and connection reset all land in STOPPED/UNKNOWN territory; BANKRUPT
 *    requires a documented court decision.
 *  - Absence of a 2024 snapshot is not evidence a service did not exist in
 *    2024. It yields UNKNOWN, not "not yet launched".
 *
 * Usage: node tools/build-normalized.mjs [--dir <research dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { readCsvObjects, writeCsv, writeJson, tri, nameKey } from './csv.mjs';

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const DIR = path.resolve(argOf('--dir', 'research/retirement-agency-second-career-2026'));
const RAW = path.join(DIR, 'raw');
const NORM = path.join(DIR, 'normalized');
const TODAY = '2026-10-07';

const BOOL_FIELDS = [
  'lawyer_supervised_claim', 'lawyer_operated', 'labor_union_operated', 'labor_union_partnered',
  'refund_guarantee', 'support_24h', 'line_support', 'phone_support',
  'negotiation_claim', 'paid_leave_claim', 'unpaid_wage_claim', 'documents_claim',
  'career_support_claim', 'job_placement_claim', 'career_counseling_claim', 'agent_referral_claim',
  'resume_support_claim', 'interview_support_claim',
  'unemployment_support_claim', 'post_resignation_support_claim',
  'targets_20s', 'targets_new_grad', 'targets_second_new_grad',
  'targets_early_leavers', 'targets_first_resignation',
  'application_available',
];

const CAREER_TYPES = new Set(['NONE', 'INFORMATION_ONLY', 'PARTNER_REFERRAL', 'CAREER_COUNSELING', 'JOB_PLACEMENT', 'UNKNOWN']);
const OPERATOR_TYPES = new Set(['PRIVATE', 'LAW_FIRM', 'LABOR_UNION', 'OTHER', 'UNKNOWN']);

/** Normalise a tri-state cell to the literal we store, preserving "unchecked". */
const triCell = (v) => { const t = tri(v); return t === null ? '' : String(t); };

function main() {
  const candidates = readCsvObjects(path.join(NORM, 'service_candidates.csv'))
    .filter((c) => c.in_scope === 'true');

  /**
   * Join raw files on the service NAME, not the id.
   *
   * The raw sweeps were collected while ids were still positional, so their
   * service_id values refer to an earlier numbering. Names survived the
   * renumbering; ids did not. Keying on the name also lets a file that used a
   * variant spelling still find its service.
   */
  const indexByName = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const k = nameKey(r.service_name ?? r.operator_name ?? '');
      if (k && !m.has(k)) m.set(k, r);
    }
    return m;
  };
  const lookup = (index, c) => {
    for (const n of [c.service_name, ...(c.name_variants ? c.name_variants.split(' | ') : [])]) {
      const hit = index.get(nameKey(n));
      if (hit) return hit;
    }
    return {};
  };

  const liveness = indexByName(readCsvObjects(path.join(RAW, 'liveness_checks.csv')));
  const discovery = indexByName(readCsvObjects(path.join(RAW, 'url_discovery.csv')));
  const exits = readCsvObjects(path.join(RAW, 'market_exit_events.csv'));

  // corporate_lookup is keyed by operator, so it needs the service's own
  // id-era row matched by name of the service it was collected for.
  const corporateRows = readCsvObjects(path.join(RAW, 'corporate_lookup.csv'));

  const fieldRows = [];
  for (const f of fs.readdirSync(RAW).filter((n) => /^service_fields_batch.*\.csv$/.test(n))) {
    for (const r of readCsvObjects(path.join(RAW, f))) fieldRows.push({ ...r, __batch: f });
  }
  const fields = indexByName(fieldRows);

  // Corporate rows carry the old service_id plus the operator name; bridge
  // them to services through the operator name that the field sweep recorded.
  const corporateByOperator = new Map();
  for (const r of corporateRows) {
    const k = (r.operator_name ?? '').replace(/\s/g, '');
    if (k && !corporateByOperator.has(k)) corporateByOperator.set(k, r);
  }
  const corporateByOldId = new Map(corporateRows.map((r) => [r.service_id, r]));
  const fieldsOldIdByName = new Map(fieldRows.map((r) => [nameKey(r.service_name), r.service_id]));

  // Archived snapshots actually fetched and read, keyed by name+year.
  const archiveIndex = new Map();
  for (const a of readCsvObjects(path.join(RAW, 'archive_snapshots.csv'))) {
    const k = `${nameKey(a.service_name)}|${a.snapshot_year}`;
    if (!archiveIndex.has(k)) archiveIndex.set(k, a);
  }
  // Services whose archived capture is the firm's homepage rather than the
  // 退職代行 landing page: their "no change" readings are an artefact of what
  // was archived, so downstream analysis must not treat them as measurements.
  const scopeNotes = new Map(
    readCsvObjects(path.join(RAW, 'archive_scope_notes.csv'))
      .map((r) => [nameKey(r.service_name), r]),
  );

  // Exit events are keyed by free-text service name, so match on a loose
  // containment against the canonical name and its variants.
  const exitFor = (c) => {
    const names = [c.service_name, ...(c.name_variants ? c.name_variants.split(' | ') : [])]
      .map((n) => n.replace(/退職代行|サービス|\s/g, '')).filter(Boolean);
    return exits.filter((e) => {
      const en = (e.service_name ?? '').replace(/退職代行|サービス|\s/g, '');
      if (!en) return false;
      return names.some((n) => n && (n.includes(en) || en.includes(n)));
    });
  };

  const services = [];
  const evidence = [];
  const addEvidence = (service_id, field, value, src) => {
    if (!value) return;
    evidence.push({
      service_id, field, value,
      source_url: src.source_url ?? '', source_title: src.source_title ?? '',
      source_type: src.source_type ?? 'OTHER', published_at: src.published_at ?? '',
      retrieved_at: src.retrieved_at ?? TODAY, archive_url: src.archive_url ?? '',
      quote_or_note: src.quote_or_note ?? '',
    });
  };

  for (const c of candidates) {
    const f = lookup(fields, c);
    const lv = lookup(liveness, c);
    const dc = lookup(discovery, c);
    const operatorKey = (f.operator_name ?? dc.operator_name ?? '').replace(/\s/g, '');
    const cp = corporateByOperator.get(operatorKey)
      ?? corporateByOldId.get(fieldsOldIdByName.get(nameKey(c.service_name)) ?? '')
      ?? {};
    const ev = exitFor(c);

    const bankruptcyEvent = ev.find((e) => e.event_type === 'BANKRUPTCY');
    const shutdownEvent = ev.find((e) => e.event_type === 'SHUTDOWN_ANNOUNCED');
    const dissolutionEvent = ev.find((e) => e.event_type === 'DISSOLUTION');

    const httpStatus = lv.http_status || dc.fetch_outcome || '';
    const fetchError = lv.fetch_error || '';
    const alive = tri(lv.website_alive);
    const applicationAvailable = tri(f.application_available);

    // --- status_2026 -------------------------------------------------------
    // Ordered so that documentary evidence always beats a network observation.
    let status2026 = 'UNKNOWN';
    let statusDetail = '';
    if (bankruptcyEvent) {
      status2026 = 'BANKRUPT';
      statusDetail = `破産手続開始決定 ${bankruptcyEvent.event_date || '日付不明'}（${bankruptcyEvent.source_type}）: ${bankruptcyEvent.event_detail ?? ''}`;
    } else if (dissolutionEvent) {
      status2026 = 'CORPORATE_CLOSED';
      statusDetail = `法人閉鎖 ${dissolutionEvent.event_date || '日付不明'}（${dissolutionEvent.source_type}）`;
    } else if (cp.registration_closed === 'true') {
      status2026 = 'CORPORATE_CLOSED';
      statusDetail = `法人番号公表サイトで登記記録の閉鎖を確認（${cp.registration_closed_date || '日付不明'}）`;
    } else if (shutdownEvent) {
      status2026 = 'STOPPED';
      statusDetail = `公式のサービス終了告知 ${shutdownEvent.event_date || '日付不明'}`;
    } else if (alive === true && applicationAvailable === true) {
      status2026 = 'ACTIVE';
      statusDetail = `${TODAY} 時点でサイトが200応答し、申込または相談の経路を確認`;
    } else if (alive === true) {
      status2026 = 'LIKELY_ACTIVE';
      statusDetail = `${TODAY} 時点でサイトは200応答するが、申込機能の稼働まで確認できていない`;
    } else if (fetchError.startsWith('dns_not_resolved')) {
      // Strong signal, but a dead domain is not a legal exit: STOPPED only,
      // and the observation itself is written down.
      status2026 = 'STOPPED';
      statusDetail = `${TODAY} 時点で公式ドメインが名前解決できない（${fetchError}）。倒産の確認ではない`;
    } else if (httpStatus === '404') {
      status2026 = 'STOPPED';
      statusDetail = `${TODAY} 時点で公式URLがHTTP 404。倒産の確認ではない`;
    } else if (fetchError || httpStatus) {
      status2026 = 'UNKNOWN';
      statusDetail = `${TODAY} 時点で到達できず（${fetchError || `HTTP ${httpStatus}`}）。営業状態は判断材料不足`;
    } else {
      status2026 = 'UNKNOWN';
      statusDetail = '公式URLを特定できず、営業状態を確認できていない';
    }

    // --- status_2024 / 2025 ------------------------------------------------
    // Evidence is a snapshot we actually read, not merely one the availability
    // API claimed to hold: that API answered differently on consecutive runs,
    // so its say-so alone is too unstable to drive a status column. No
    // snapshot still means we do not know, never "did not exist".
    const snap = (year) => {
      for (const nm of [c.service_name, ...(c.name_variants ? c.name_variants.split(' | ') : [])]) {
        const hit = archiveIndex.get(`${nameKey(nm)}|${year}`);
        if (hit) return hit;
      }
      return null;
    };
    const s24 = snap('2024');
    const s25 = snap('2025');
    const readOk = (s) => Boolean(s && /^200/.test(s.fetch_outcome ?? ''));
    const status2024 = readOk(s24) ? 'LIKELY_ACTIVE' : 'UNKNOWN';
    const status2025 = readOk(s25) ? 'LIKELY_ACTIVE' : 'UNKNOWN';
    const archiveScope = scopeNotes.get(nameKey(c.service_name))?.archive_scope ?? '';

    // --- operator / review flags -------------------------------------------
    const operatorType = OPERATOR_TYPES.has((f.operator_type ?? '').toUpperCase())
      ? f.operator_type.toUpperCase() : 'UNKNOWN';
    const careerType = CAREER_TYPES.has((f.career_support_type ?? '').toUpperCase())
      ? f.career_support_type.toUpperCase() : 'UNKNOWN';

    const reviewReasons = [];
    if (c.operator_type_conflict === 'true') reviewReasons.push('比較サイト間で運営形態の記述が矛盾');
    if (tri(f.labor_union_operated) === true && operatorType === 'PRIVATE') {
      reviewReasons.push('サイトは労働組合運営と表示するが特商法の販売業者は民間企業');
    }
    if (cp.address_match === 'false') reviewReasons.push('特商法の所在地と法人番号公表サイトの所在地が不一致');
    if (cp.multiple_candidates === 'true') reviewReasons.push('同名法人が複数あり法人番号を確定できない');
    if (c.single_source === 'true' && !f.service_id) reviewReasons.push('出典1件のみで公式サイト未確認');

    const row = {
      service_id: c.service_id,
      service_name: c.service_name,
      name_variants: c.name_variants,
      operator_name: f.operator_name || dc.operator_name || '',
      operator_address: f.operator_address || '',
      operator_representative: f.operator_representative || '',
      corporate_number: cp.corporate_number || '',
      operator_type: operatorType,
      service_url: f.official_url || dc.official_url || lv.checked_url || c.service_url || '',
      tokusho_url: f.tokusho_url || '',

      first_seen_date: TODAY,
      service_launch_date: f.service_launch_date || '',
      corporation_established_date: '',
      corporate_number_assigned_date: cp.corporate_number_assigned_date || '',

      status_2024: status2024,
      status_2025: status2025,
      status_2026: status2026,
      status_detail: statusDetail,

      price_2024: s24?.price_shown || '',
      price_2025: s25?.price_shown || '',
      price_2026: f.normal_price_2026 || '',
      // Attributes can only be read off a live site, so every service with a
      // known 2026 price is by construction a survivor. Comparing survival by
      // price band on that column alone would be pure survivorship bias, so
      // carry the last price we ever observed — from an archive for the
      // services that are gone — and record where it came from.
      price_last_observed: f.normal_price_2026 || s25?.price_shown || s24?.price_shown || '',
      price_last_observed_year: f.normal_price_2026 ? '2026'
        : (s25?.price_shown ? '2025' : (s24?.price_shown ? '2024' : '')),
      price_last_observed_source: f.normal_price_2026 ? 'OFFICIAL_2026'
        : (s25?.price_shown ? 'ARCHIVE_2025' : (s24?.price_shown ? 'ARCHIVE_2024' : '')),
      normal_price_2026: f.normal_price_2026 || '',
      campaign_price_2026: f.campaign_price_2026 || '',
      price_notes: f.price_notes || '',

      additional_fee_claim_raw: f.additional_fee_claim || '',
      union_or_firm_name: f.union_or_firm_name || '',
      career_support_type: careerType,

      website_alive: triCell(lv.website_alive),
      http_status_2026: httpStatus,
      fetch_error_2026: fetchError,
      apex_fallback_from: lv.apex_fallback_from || '',

      corporate_status: cp.registration_closed === 'true' ? 'CLOSED'
        : (cp.corporate_number ? 'REGISTERED' : ''),
      corporate_closed_date: cp.registration_closed_date || '',

      shutdown_announced: shutdownEvent ? 'true' : '',
      shutdown_date: shutdownEvent?.event_date || '',
      bankruptcy: bankruptcyEvent ? 'true' : '',
      bankruptcy_date: bankruptcyEvent?.event_date || '',
      legal_action_count: ev.filter((e) => e.event_type === 'LEGAL_ACTION').length || '',

      archive_2024_url: s24?.snapshot_url || lv.archive_2024_url || '',
      archive_2025_url: s25?.snapshot_url || lv.archive_2025_url || '',
      archive_scope: archiveScope,
      current_url: lv.final_url || '',

      mention_count: c.mention_count,
      source_count: c.source_count,
      last_verified_at: TODAY,
      confidence: status2026 === 'UNKNOWN' ? 'LOW'
        : (f.service_id ? 'HIGH' : 'MEDIUM'),
      review_required: reviewReasons.length ? 'true' : 'false',
      review_reasons: reviewReasons.join(' / '),
      notes: [f.notes, dc.notes].filter(Boolean).join(' / '),
      fields_batch: f.__batch || '',
    };
    for (const b of BOOL_FIELDS) row[b] = triCell(f[b]);
    services.push(row);

    // Evidence rows for the claims most likely to be disputed.
    if (f.official_url) {
      for (const field of ['career_support_type', 'targets_second_new_grad', 'normal_price_2026', 'operator_name']) {
        addEvidence(c.service_id, field, row[field] ?? f[field] ?? '', {
          source_url: field === 'operator_name' && f.tokusho_url ? f.tokusho_url : f.official_url,
          source_title: c.service_name,
          source_type: 'OFFICIAL',
          retrieved_at: f.retrieved_at || TODAY,
          quote_or_note: f.evidence_quotes || '',
        });
      }
    }
    for (const e of ev) {
      addEvidence(c.service_id, `event:${e.event_type}`, e.event_detail || e.event_type, e);
    }
  }

  const columns = [
    'service_id', 'service_name', 'name_variants', 'operator_name', 'operator_address',
    'operator_representative', 'corporate_number', 'operator_type', 'service_url', 'tokusho_url',
    'first_seen_date', 'service_launch_date', 'corporation_established_date', 'corporate_number_assigned_date',
    'status_2024', 'status_2025', 'status_2026', 'status_detail',
    'price_2024', 'price_2025', 'price_2026', 'price_last_observed', 'price_last_observed_year',
    'price_last_observed_source', 'normal_price_2026', 'campaign_price_2026', 'price_notes',
    'lawyer_supervised_claim', 'lawyer_operated', 'labor_union_operated', 'labor_union_partnered',
    'union_or_firm_name', 'additional_fee_claim_raw', 'refund_guarantee', 'support_24h',
    'line_support', 'phone_support', 'negotiation_claim', 'paid_leave_claim', 'unpaid_wage_claim',
    'documents_claim', 'career_support_type', 'career_support_claim', 'job_placement_claim',
    'career_counseling_claim', 'agent_referral_claim', 'resume_support_claim', 'interview_support_claim',
    'unemployment_support_claim', 'post_resignation_support_claim',
    'targets_20s', 'targets_new_grad', 'targets_second_new_grad', 'targets_early_leavers',
    'targets_first_resignation', 'application_available',
    'website_alive', 'http_status_2026', 'fetch_error_2026', 'apex_fallback_from',
    'corporate_status', 'corporate_closed_date', 'shutdown_announced', 'shutdown_date',
    'bankruptcy', 'bankruptcy_date', 'legal_action_count',
    'archive_2024_url', 'archive_2025_url', 'archive_scope', 'current_url',
    'mention_count', 'source_count', 'last_verified_at', 'confidence',
    'review_required', 'review_reasons', 'notes', 'fields_batch',
  ];
  writeCsv(path.join(NORM, 'services.csv'), columns, services);

  // operators.csv — one row per distinct operator name we managed to read.
  const byOperator = new Map();
  for (const s of services) {
    const key = s.operator_name || `(不明) ${s.service_name}`;
    if (!byOperator.has(key)) {
      byOperator.set(key, {
        operator_name: s.operator_name, corporate_number: s.corporate_number,
        operator_address: s.operator_address, operator_representative: s.operator_representative,
        operator_type: s.operator_type, corporate_number_assigned_date: s.corporate_number_assigned_date,
        corporate_status: s.corporate_status, corporate_closed_date: s.corporate_closed_date,
        services: [], service_count: 0, review_required: s.review_required,
      });
    }
    const o = byOperator.get(key);
    o.services.push(s.service_name);
    o.service_count = o.services.length;
    if (s.review_required === 'true') o.review_required = 'true';
  }
  writeCsv(path.join(NORM, 'operators.csv'), [
    'operator_name', 'corporate_number', 'operator_address', 'operator_representative',
    'operator_type', 'corporate_number_assigned_date', 'corporate_status', 'corporate_closed_date',
    'service_count', 'service_names', 'review_required',
  ], [...byOperator.values()].map((o) => ({ ...o, service_names: o.services.join(' | ') })));

  writeCsv(path.join(NORM, 'evidence.csv'), [
    'service_id', 'field', 'value', 'source_url', 'source_title', 'source_type',
    'published_at', 'retrieved_at', 'archive_url', 'quote_or_note',
  ], evidence);

  // --- data quality report (completion condition 22) ---------------------
  const n = services.length;
  const countBy = (fn) => services.reduce((a, s) => { const k = fn(s) || '(empty)'; a[k] = (a[k] ?? 0) + 1; return a; }, {});
  const filled = (field) => services.filter((s) => s[field] !== '' && s[field] !== undefined).length;
  const quality = {
    generatedAt: new Date().toISOString(),
    population: n,
    officialUrlObtained: filled('service_url'),
    officialUrlRate: Number((filled('service_url') / n).toFixed(4)),
    operatorIdentified: filled('operator_name'),
    operatorRate: Number((filled('operator_name') / n).toFixed(4)),
    corporateNumberObtained: filled('corporate_number'),
    corporateNumberRate: Number((filled('corporate_number') / n).toFixed(4)),
    status2026Determined: services.filter((s) => s.status_2026 !== 'UNKNOWN').length,
    status2026Rate: Number((services.filter((s) => s.status_2026 !== 'UNKNOWN').length / n).toFixed(4)),
    price2026Obtained: filled('normal_price_2026'),
    price2026Rate: Number((filled('normal_price_2026') / n).toFixed(4)),
    archive2024Obtained: filled('archive_2024_url'),
    archive2025Obtained: filled('archive_2025_url'),
    careerSupportDetermined: services.filter((s) => s.career_support_type !== 'UNKNOWN').length,
    secondNewGradDetermined: services.filter((s) => s.targets_second_new_grad !== '').length,
    unknownStatusCount: services.filter((s) => s.status_2026 === 'UNKNOWN').length,
    reviewRequiredCount: services.filter((s) => s.review_required === 'true').length,
    statusDistribution2026: countBy((s) => s.status_2026),
    statusDistribution2025: countBy((s) => s.status_2025),
    statusDistribution2024: countBy((s) => s.status_2024),
    operatorTypeDistribution: countBy((s) => s.operator_type),
    careerSupportDistribution: countBy((s) => s.career_support_type),
    fieldsCollectedFor: services.filter((s) => s.fields_batch).length,
    fieldsNotCollectedFor: services.filter((s) => !s.fields_batch).map((s) => s.service_name),
    evidenceRows: evidence.length,
    caveats: [
      'additional_fee_claim_raw はバッチ間で解釈が揺れている（「追加料金なしと謳っている」をtrueとしたバッチがある）ため、見出し数値には使用しない。',
      'status_2024 / status_2025 は、その年のスナップショットを実際に取得して読めた場合のみ LIKELY_ACTIVE とする。Wayback の availability API は連続実行で異なる結果を返したため、API上の有無だけでは判定していない。スナップショットがない年は UNKNOWN であり「存在しなかった」ではない。',
      'archive_scope = APEX_HOMEPAGE のサービスは、保存されていたのが退職代行LPではなく事務所トップページである。これらの訴求文言の「変化なし」は観測範囲の制約であり、変化が無かったことの証拠ではない。',
      'corporation_established_date は未取得。法人番号公表サイトから得られるのは corporate_number_assigned_date（法人番号指定年月日）であり設立年月日ではない。',
    ],
  };
  writeJson(path.join(DIR, 'analysis', 'data_quality.json'), quality);
  console.log(JSON.stringify(quality, null, 2));
}

main();
