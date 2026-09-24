import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("API-free Article Factory launch surfaces", () => {
  it("does not allow a paid article generation workflow from the dashboard", () => {
    const route = source("src/app/internal/api/article-factory/start/route.ts");
    expect(route).toContain("ARTICLE_FACTORY_CHATGPT_ONLY");
    expect(route).not.toContain("newArticleWorkflow");
    expect(route).not.toMatch(/\bstart\(/);
  });

  it("keeps stored candidate reads but disables paid candidate POST", () => {
    const route = source("src/app/internal/api/article-factory/candidates/route.ts");
    expect(route).toContain("export async function GET");
    expect(route).toContain("ARTICLE_FACTORY_CHATGPT_ONLY");
    expect(route).not.toContain("generateCandidateBatch");
  });

  it("does not trigger LLM candidate generation from the old Vercel cron", () => {
    const cron = source("src/app/api/cron/article-candidates/route.ts");
    const vercel = JSON.parse(source("vercel.json")) as { crons?: unknown[] };
    expect(cron).toContain("ARTICLE_FACTORY_CHATGPT_ONLY");
    expect(cron).not.toContain("generateCandidateBatch");
    expect(vercel.crons ?? []).toEqual([]);
  });

  it("never calls either paid POST endpoint from the new-article dashboard", () => {
    const ui = source("src/app/internal/dashboard/article-factory/NewArticleTab.tsx");
    expect(ui).not.toContain('fetch("/internal/api/article-factory/start"');
    expect(ui).not.toMatch(/fetch\("\/internal\/api\/article-factory\/candidates",\s*\{\s*method:\s*"POST"/);
    expect(ui).toContain("候補をコピー");
  });
});
