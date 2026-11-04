#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "data", "research-sources.json");
const PREVIOUS_PATH = path.join(ROOT, "data", "research", "source-status.json");
const OUT_PATH = process.env.RESEARCH_WATCH_OUTPUT || path.join(ROOT, "tmp", "research-source-status.json");

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 180) : null;
}

async function readPrevious() {
  try {
    const raw = JSON.parse(await fs.readFile(PREVIOUS_PATH, "utf8"));
    return new Map((raw.sources || []).map((item) => [item.id, item]));
  } catch {
    return new Map();
  }
}

async function check(source, previous) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(source.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "NARU Research Watch/0.1 (+https://naru-career.com)",
        accept: "text/html,application/xhtml+xml",
        "accept-encoding": "identity",
      },
    });
    const text = (await response.text()).slice(0, 1_500_000);
    const normalized = stripHtml(text);
    const hash = crypto.createHash("sha256").update(normalized).digest("hex");
    return {
      id: source.id,
      label: source.label,
      url: source.url,
      checkedAt: new Date().toISOString(),
      httpStatus: response.status,
      finalUrl: response.url,
      title: titleOf(text),
      bytesSampled: Buffer.byteLength(text),
      hash,
      changed: Boolean(previous?.hash && previous.hash !== hash),
      previousHash: previous?.hash || null,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      id: source.id,
      label: source.label,
      url: source.url,
      checkedAt: new Date().toISOString(),
      httpStatus: null,
      finalUrl: null,
      title: null,
      bytesSampled: 0,
      hash: previous?.hash || null,
      changed: false,
      previousHash: previous?.hash || null,
      etag: null,
      lastModified: null,
      error: error instanceof Error ? error.message.slice(0, 220) : String(error).slice(0, 220),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  const previous = await readPrevious();
  const sources = await Promise.all(
    (config.sources || []).map((source) => check(source, previous.get(source.id)))
  );
  const result = {
    generatedAt: new Date().toISOString(),
    mode: "metadata_only_no_page_body_saved",
    changedCount: sources.filter((x) => x.changed).length,
    failedCount: sources.filter((x) => x.error).length,
    sources,
  };
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(
    `research watch: ${sources.length} sources / changed=${result.changedCount} / failed=${result.failedCount}`
  );
}
main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
