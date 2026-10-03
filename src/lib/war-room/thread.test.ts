import { describe, expect, it } from "vitest";

import { extractThreadResourceLinks, formatThreadContext } from "./thread";

describe("formatThreadContext", () => {
  it("keeps recent Slack thread messages and marks the current one", () => {
    const result = formatThreadContext(
      [
        { user: "U1", text: "上の資料について", ts: "1" },
        { bot_id: "B1", text: "確認します", ts: "2" },
        { user: "U1", text: "これ見れてる？", ts: "3" },
      ],
      "3"
    );

    expect(result).toContain("[prior][user:U1] 上の資料について");
    expect(result).toContain("[prior][bot] 確認します");
    expect(result).toContain("[current][user:U1] これ見れてる？");
  });

  it("preserves Drive resource links even when they appear in older messages", () => {
    const result = formatThreadContext([
      {
        user: "U1",
        text: "資料 https://drive.google.com/drive/folders/folder_ABC-123",
        ts: "1",
      },
      ...Array.from({ length: 30 }, (_, index) => ({
        user: "U1",
        text: `後続メッセージ ${index} ${"x".repeat(400)}`,
        ts: String(index + 2),
      })),
    ]);

    expect(result).toContain("## Thread resource links");
    expect(result).toContain(
      "https://drive.google.com/drive/folders/folder_ABC-123"
    );
  });

  it("deduplicates Drive resource links", () => {
    expect(
      extractThreadResourceLinks([
        { text: "https://drive.google.com/drive/folders/abc", ts: "1" },
        { text: "<https://drive.google.com/drive/folders/abc|Drive>", ts: "2" },
      ])
    ).toEqual(["https://drive.google.com/drive/folders/abc"]);
  });

  it("drops subtype messages", () => {
    const result = formatThreadContext([
      { user: "U1", text: "keep", ts: "1" },
      { user: "U1", text: "drop", ts: "2", subtype: "channel_join" },
    ]);

    expect(result).toContain("keep");
    expect(result).not.toContain("drop");
  });
});
