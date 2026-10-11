#!/usr/bin/env node
/**
 * Audit NARU article image files without changing their bytes.
 *
 * Default: inspect local file metadata only (no uploads/API usage).
 * --verify: explicitly send each selected image to the OpenAI Content Provenance API.
 * A negative SynthID result does NOT prove a file wasn't AI-generated.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const directory = path.join(process.cwd(), "public", "images", "articles");
const supported = /\.(webp|png|jpg|jpeg)$/i;
const metadataFields = ["exif", "xmp", "iptc", "icc", "comments"];

function parseArgs(argv) {
  const args = { slug: null, limit: null, verify: false, output: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--verify") args.verify = true;
    else if (arg === "--slug") args.slug = argv[++i];
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--output") args.output = argv[++i];
    else if (arg === "--help") {
      console.log("Usage: node scripts/audit-image-provenance.mjs [--slug <article-slug>] [--limit N] [--verify] [--output report.json]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug))
    throw new Error("Invalid --slug");
  if (args.limit !== null && (!Number.isSafeInteger(args.limit) || args.limit < 1))
    throw new Error("--limit must be a positive integer");
  return args;
}

function mimeFor(file) {
  return file.toLowerCase().endsWith(".webp") ? "image/webp"
    : file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

async function verifyWithOpenAI(filename, bytes, apiKey) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeFor(filename) }), filename);
  const response = await fetch("https://api.openai.com/v1/content_provenance_checks", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    // Never log a potentially sensitive API error body or credentials.
    throw new Error(`Content Provenance API HTTP ${response.status}`);
  }
  const result = await response.json();
  return {
    c2pa: result.results?.find((entry) => entry.type === "c2pa") ?? null,
    synthid: result.results?.find((entry) => entry.type === "synthid") ?? null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.verify && !process.env.OPENAI_API_KEY) {
    throw new Error("--verify needs OPENAI_API_KEY; no images were uploaded.");
  }
  const names = (await fs.readdir(directory))
    .filter((name) => supported.test(name))
    .filter((name) => !args.slug || name.startsWith(`${args.slug}-`))
    .sort()
    .slice(0, args.limit ?? undefined);
  if (!names.length) throw new Error("No matching article images");

  const report = {
    checkedAt: new Date().toISOString(),
    scope: args.slug || "all-article-images",
    localMetadataScan: true,
    openAIProvenanceChecked: args.verify,
    warning: "Metadata scan does not test invisible watermarks. SynthID not_detected is not proof of human origin. OpenAI API only identifies supported OpenAI signals.",
    images: [],
  };
  for (const name of names) {
    const filename = path.join(directory, name);
    const item = { file: name, sha256: null, format: null, metadataFieldsFound: [], c2pa: "not_checked", synthid: "not_checked" };
    try {
      const bytes = await fs.readFile(filename);
      item.sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      const metadata = await sharp(bytes).metadata();
      item.format = metadata.format;
      item.metadataFieldsFound = metadataFields.filter((key) => metadata[key] != null);
      if (args.verify) {
        const result = await verifyWithOpenAI(name, bytes, process.env.OPENAI_API_KEY);
        item.c2pa = result.c2pa ?? "not_returned";
        item.synthid = result.synthid ?? "not_returned";
      }
    } catch (error) {
      item.error = error instanceof Error ? error.message : String(error);
      process.exitCode = 1;
    }
    report.images.push(item);
  }

  report.summary = {
    total: report.images.length,
    withMetadata: report.images.filter((item) => item.metadataFieldsFound.length).length,
    synthidDetected: report.images.filter((item) => item.synthid?.outcome === "detected").length,
    synthidNotDetected: report.images.filter((item) => item.synthid?.outcome === "not_detected").length,
    synthidNotChecked: report.images.filter((item) => item.synthid === "not_checked").length,
    errors: report.images.filter((item) => item.error).length,
  };
  if (args.output) {
    const output = path.resolve(args.output);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    console.log(`Report written: ${output}`);
  }
  console.log(JSON.stringify(report.summary, null, 2));
  if (!args.verify) console.log("SynthID was NOT checked (add --verify with OPENAI_API_KEY).");
  for (const item of report.images.filter((item) => item.error || item.metadataFieldsFound.length)) {
    console.log(`${item.file}: metadata=${item.metadataFieldsFound.join(",") || "-"} error=${item.error || "-"}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
