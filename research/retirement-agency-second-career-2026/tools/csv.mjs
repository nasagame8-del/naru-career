/**
 * CSV helpers shared by the tools in this directory.
 *
 * Files are written with a BOM because the deliverables are opened in Excel,
 * and read with the BOM stripped so a round trip is lossless.
 */
import fs from 'node:fs';
import path from 'node:path';

export function parseCsv(str) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  const s = str.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false; } else cell += c;
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

export function readCsvObjects(file) {
  if (!fs.existsSync(file)) return [];
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export const csvEscape = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function writeCsv(file, columns, rows) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvEscape(r[c])).join(','));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `﻿${lines.join('\n')}\n`, 'utf8');
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Tri-state field access. The project distinguishes three states and the
 * distinction is load-bearing: `true` claimed, `false` checked and absent,
 * null not checked. Anything unrecognised becomes null rather than false, so
 * a typo can never silently become a negative finding.
 */
export function tri(v) {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
}

/** Count of true / false / null for a tri-state column, with its denominator. */
export function triCounts(rows, field) {
  let t = 0; let f = 0; let n = 0;
  for (const r of rows) {
    const v = tri(r[field]);
    if (v === true) t += 1; else if (v === false) f += 1; else n += 1;
  }
  return {
    field,
    rows: rows.length,
    true: t,
    false: f,
    not_checked: n,
    // Rates are over what we actually determined, never over the whole
    // population, so an unchecked field cannot masquerade as a negative.
    determined: t + f,
    rate_among_determined: (t + f) ? Number((t / (t + f)).toFixed(4)) : null,
  };
}

/** Yen amount from a printed price string; null when nothing parseable. */
export function parseYen(s) {
  if (!s) return null;
  const txt = String(s).replace(/[，,]/g, '');
  const man = /([0-9]+(?:\.[0-9]+)?)\s*万円/.exec(txt);
  if (man) return Math.round(Number(man[1]) * 10_000);
  const yen = /([0-9]{3,7})\s*円/.exec(txt);
  if (yen) return Number(yen[1]);
  const bare = /^([0-9]{4,7})$/.exec(txt.trim());
  if (bare) return Number(bare[1]);
  return null;
}

export function priceBand(yen) {
  if (yen === null || yen === undefined || Number.isNaN(yen)) return 'UNKNOWN';
  if (yen < 20_000) return 'UNDER_20000';
  if (yen < 25_000) return '20000_24999';
  if (yen < 30_000) return '25000_29999';
  return '30000_PLUS';
}

export const median = (nums) => {
  const a = nums.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export const mean = (nums) => {
  const a = nums.filter((n) => typeof n === 'number' && Number.isFinite(n));
  return a.length ? Number((a.reduce((s, n) => s + n, 0) / a.length).toFixed(1)) : null;
};

export const rate = (n, d) => (d ? Number((n / d).toFixed(4)) : null);

/** Full-width ASCII and ideographic spaces to their half-width forms. */
function toHalfWidth(s) {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ');
}

/**
 * Join key for "is this the same service?".
 *
 * Service names are the only stable identifier across the raw sweeps: row
 * ordering changes whenever the population is re-deduplicated, so positional
 * ids must never be used to join files produced by different runs.
 */
export function nameKey(raw) {
  if (!raw) return '';
  let s = toHalfWidth(String(raw)).trim().toLowerCase();
  s = s.replace(/[（(][^）)]*[）)]/g, '');
  s = s.replace(/【[^】]*】/g, '');
  s = s.replace(/の退職代行(サービス)?$/u, '');
  s = s.replace(/退職代行(サービス)?/gu, '');
  s = s.replace(/[\s\-–—_・/|]+/g, '');
  s = s.replace(/サービス$/u, '');
  return s;
}
