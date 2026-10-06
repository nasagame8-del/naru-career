#!/usr/bin/env node
/**
 * Merge the raw discovery batches into one deduplicated candidate list.
 *
 * Discovery ran as four independent sweeps (comparison sites, union/lawyer
 * pages, launch announcements, exit events). The same service shows up in
 * several of them under different spellings, so this script keeps every raw
 * row with its source and derives a separate candidate list on top.
 *
 * Matching is deliberately conservative: a name match alone can merge two
 * different companies that use the same service name, so an official domain,
 * when we have one, outranks the name. Affiliate redirect hosts are never
 * treated as a service's own domain.
 *
 * Usage:
 *   node tools/merge-discovered.mjs
 *   node tools/merge-discovered.mjs --dir <research dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { nameKey } from './csv.mjs';

const DIR = (() => {
  const i = process.argv.indexOf('--dir');
  return i >= 0 ? process.argv[i + 1] : path.resolve('research/retirement-agency-second-career-2026');
})();
const RAW = path.join(DIR, 'raw');

// Redirect/tracking hosts that comparison sites use in place of the real URL.
const AFFILIATE_HOSTS = [
  'asplay.biz', 'moshimo.com', 'af.moshimo.com', 'rentracks.jp', 'a8.net', 'px.a8.net',
  'accesstrade.net', 'valuecommerce.com', 'ck.jp.ap.valuecommerce.com', 'link-a.net',
  'felmat.net', 'afi-b.com', 'tcs-asp.net', 'tg-affiliate.com', 'presco.asia',
];

// ---------------------------------------------------------------------------
// csv
// ---------------------------------------------------------------------------

function parseCsv(str) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const s = str.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 1; } else { quoted = false; }
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

function readCsvObjects(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const csvEscape = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function writeCsv(file, columns, rows) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvEscape(r[c])).join(','));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `﻿${lines.join('\n')}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// normalisation
// ---------------------------------------------------------------------------

/** Registrable-ish domain, or '' when the URL is missing or an affiliate hop. */
export function serviceDomain(url) {
  if (!url) return '';
  let u;
  try { u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); } catch { return ''; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (!host.includes('.')) return '';
  if (AFFILIATE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return '';
  const parts = host.split('.');
  const jpSecond = new Set(['co', 'or', 'ne', 'ac', 'go', 'lg', 'gr', 'ed']);
  if (parts.length >= 3 && parts.at(-1) === 'jp' && jpSecond.has(parts.at(-2))) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

// ---------------------------------------------------------------------------
// union-find over (nameKey, domain)
// ---------------------------------------------------------------------------

class DisjointSet {
  constructor() { this.parent = new Map(); }
  find(x) {
    if (!this.parent.has(x)) { this.parent.set(x, x); return x; }
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r);
    while (this.parent.get(x) !== r) { const n = this.parent.get(x); this.parent.set(x, r); x = n; }
    return r;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

// ---------------------------------------------------------------------------

function main() {
  const files = fs.readdirSync(RAW)
    .filter((f) => /^discovered_services_batch_.*\.csv$/.test(f))
    .sort();
  if (!files.length) {
    console.error(`No discovery batches found in ${RAW}`);
    process.exit(1);
  }

  const rawRows = [];
  const perFile = {};
  for (const f of files) {
    const rows = readCsvObjects(path.join(RAW, f));
    perFile[f] = rows.length;
    for (const r of rows) {
      const name = r.service_name ?? '';
      if (!name.trim()) continue;
      rawRows.push({
        ...r,
        batch: f,
        name_key: nameKey(name),
        domain: serviceDomain(r.service_url ?? ''),
      });
    }
  }

  // Merging by shared domain looked attractive but is wrong here: one operator
  // runs several distinct brands off one site (男の退職代行 and わたしNEXT both
  // sit on to-next.jp), so a domain union collapses services that readers
  // choose between. Names merge only via the normalisation rule plus an
  // explicit, reviewable alias file; domains stay as evidence for review.
  const aliasFile = path.join(RAW, 'alias_map.csv');
  const aliases = fs.existsSync(aliasFile) ? readCsvObjects(aliasFile) : [];
  const confirmedAlias = new Map();
  const provisionalAlias = [];
  const rejectedAlias = [];
  for (const a of aliases) {
    if (!a.variant_name || !a.canonical_name) continue;
    const status = (a.status ?? '').toUpperCase();
    const entry = { variant: a.variant_name, canonical: a.canonical_name, reason: a.reason ?? '' };
    // CONFIRMED merges. REJECTED means we checked and they are different
    // services, so it must not sit in the "pending" bucket and inflate the
    // stated uncertainty. PROVISIONAL is the only genuinely open case.
    if (status === 'CONFIRMED') confirmedAlias.set(nameKey(a.variant_name), nameKey(a.canonical_name));
    else if (status === 'REJECTED') rejectedAlias.push(entry);
    else provisionalAlias.push(entry);
  }

  const ds = new DisjointSet();
  for (const r of rawRows) {
    const nk = `n:${r.name_key}`;
    ds.find(nk);
    const target = confirmedAlias.get(r.name_key);
    if (target) ds.union(nk, `n:${target}`);
  }

  const groups = new Map();
  for (const r of rawRows) {
    const root = ds.find(`n:${r.name_key}`);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(r);
  }

  // Deterministic ids: order groups by the most-cited display name.
  const candidates = [...groups.values()].map((rows) => {
    const nameCounts = new Map();
    for (const r of rows) nameCounts.set(r.service_name, (nameCounts.get(r.service_name) ?? 0) + 1);
    const display = [...nameCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0][0];
    const domains = [...new Set(rows.map((r) => r.domain).filter(Boolean))];
    const urls = [...new Set(rows.map((r) => r.service_url).filter(Boolean))];
    const operators = [...new Set(rows.map((r) => r.operator_name).filter((v) => v && v.trim()))];
    const typesRaw = [...new Set(rows.map((r) => r.operator_type_raw).filter((v) => v && v.trim()))];
    const prices = [...new Set(rows.map((r) => r.price_raw).filter((v) => v && v.trim()))];
    const sources = [...new Set(rows.map((r) => r.source_url).filter(Boolean))];
    const batches = [...new Set(rows.map((r) => r.batch))];
    return {
      service_name: display,
      name_variants: [...nameCounts.keys()].filter((n) => n !== display).join(' | '),
      service_url: urls.find((u) => serviceDomain(u)) ?? '',
      domains: domains.join(' | '),
      operator_name_candidates: operators.join(' | '),
      operator_type_raw_candidates: typesRaw.join(' | '),
      operator_type_conflict: typesRaw.length > 1 ? 'true' : 'false',
      price_raw_candidates: prices.join(' | '),
      mention_count: rows.length,
      source_count: sources.length,
      source_urls: sources.join(' | '),
      found_in_batches: batches.join(' | '),
      // A candidate seen on only one page is kept, but flagged: it has not
      // been corroborated and may be a comparison site's own invention.
      single_source: sources.length <= 1 ? 'true' : 'false',
      no_official_url: domains.length ? 'false' : 'true',
    };
  }).sort((a, b) => b.mention_count - a.mention_count || a.service_name.localeCompare(b.service_name, 'ja'));

  // Some discovery hits are adjacent products (handover proxies, supplements,
  // plan announcements) rather than 退職代行 services. They stay in the file as
  // market-adjacency signals but must not inflate the population.
  const scopeFile = path.join(RAW, 'scope_exclusions.csv');
  const exclusions = new Map();
  if (fs.existsSync(scopeFile)) {
    for (const e of readCsvObjects(scopeFile)) {
      if (e.service_name) {
        exclusions.set(nameKey(e.service_name), {
          reason: e.exclusion_reason ?? '', category: e.category ?? '',
        });
      }
    }
  }
  for (const c of candidates) {
    const hit = exclusions.get(nameKey(c.service_name))
      ?? [...c.name_variants.split(' | '), c.service_name]
        .map((n) => exclusions.get(nameKey(n))).find(Boolean);
    c.in_scope = hit ? 'false' : 'true';
    c.exclusion_reason = hit?.reason ?? '';
    c.exclusion_category = hit?.category ?? '';
  }

  // Stable ids. Assigning them positionally was a mistake: re-running the
  // dedup after confirming one alias renumbered the whole list, which silently
  // broke the join with every raw file already collected under the old ids.
  // The registry pins a name to its id for the life of the project.
  const registryPath = path.join(DIR, 'normalized', 'service_id_registry.csv');
  const registry = new Map();
  for (const r of (fs.existsSync(registryPath) ? readCsvObjects(registryPath) : [])) {
    if (r.name_key && r.service_id) registry.set(r.name_key, r.service_id);
  }
  const used = new Set(registry.values());
  let nextId = 1;
  const allocate = () => {
    for (;;) {
      const id = `SVC${String(nextId).padStart(3, '0')}`;
      nextId += 1;
      if (!used.has(id)) { used.add(id); return id; }
    }
  };
  for (const c of candidates) {
    const keys = [c.service_name, ...(c.name_variants ? c.name_variants.split(' | ') : [])]
      .map(nameKey).filter(Boolean);
    const known = [...new Set(keys.map((k) => registry.get(k)).filter(Boolean))].sort();
    // When a merge unites groups that already had ids, keep the lowest and
    // record the ids it supersedes so earlier files remain traceable.
    c.service_id = known[0] ?? allocate();
    c.superseded_service_ids = known.slice(1).join(' | ');
    for (const k of keys) registry.set(k, c.service_id);
  }
  writeCsv(registryPath, ['name_key', 'service_id'],
    [...registry.entries()].map(([name_key, service_id]) => ({ name_key, service_id }))
      .sort((a, b) => a.service_id.localeCompare(b.service_id) || a.name_key.localeCompare(b.name_key)));

  writeCsv(path.join(RAW, 'discovered_services.csv'), [
    'batch', 'service_name', 'name_key', 'operator_name', 'operator_type_raw', 'price_raw',
    'service_url', 'domain', 'source_url', 'source_title', 'retrieved_at',
  ], rawRows);

  writeCsv(path.join(DIR, 'normalized', 'service_candidates.csv'), [
    'service_id', 'superseded_service_ids', 'service_name', 'name_variants', 'service_url', 'domains',
    'operator_name_candidates', 'operator_type_raw_candidates', 'operator_type_conflict',
    'price_raw_candidates', 'mention_count', 'source_count', 'source_urls',
    'found_in_batches', 'single_source', 'no_official_url',
    'in_scope', 'exclusion_reason', 'exclusion_category',
  ], candidates);

  const inScope = candidates.filter((c) => c.in_scope === 'true');
  const summary = {
    batchesRead: perFile,
    rawRows: rawRows.length,
    distinctRawNames: new Set(rawRows.map((r) => r.service_name)).size,
    candidatesAfterDedup: candidates.length,
    duplicatesRemoved: new Set(rawRows.map((r) => r.service_name)).size - candidates.length,
    outOfScope: candidates.length - inScope.length,
    population: inScope.length,
    withOfficialDomain: inScope.filter((c) => c.no_official_url === 'false').length,
    singleSourceCandidates: inScope.filter((c) => c.single_source === 'true').length,
    operatorTypeConflicts: inScope.filter((c) => c.operator_type_conflict === 'true').length,
    operatorNameMissing: inScope.filter((c) => !c.operator_name_candidates).length,
    // Pairs we suspect are one service but have not proved; they are still
    // counted separately, so the population is an upper bound by this many.
    provisionalDuplicatesPendingVerification: provisionalAlias,
    checkedAndConfirmedDistinct: rejectedAlias,
  };
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();
