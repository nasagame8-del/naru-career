import fs from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getArticleImagePath } from "./articles";

describe("getArticleImagePath", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("WebPがあれば既存PNGより優先する", () => {
    vi.spyOn(fs, "existsSync").mockImplementation((target) =>
      String(target).endsWith("/sample-card.webp")
    );

    expect(getArticleImagePath("sample", "card")).toBe(
      "/images/articles/sample-card.webp"
    );
  });

  it("WebPが無い既存記事ではPNGへフォールバックする", () => {
    vi.spyOn(fs, "existsSync").mockImplementation((target) =>
      String(target).endsWith("/sample-card.png")
    );

    expect(getArticleImagePath("sample", "card")).toBe(
      "/images/articles/sample-card.png"
    );
  });

  it("画像が無ければnullを返す", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    expect(getArticleImagePath("sample", "hero")).toBeNull();
  });
});
