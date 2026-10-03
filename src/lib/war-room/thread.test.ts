import { describe, expect, it } from "vitest";

import { formatThreadContext } from "./thread";

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

  it("drops subtype messages", () => {
    const result = formatThreadContext([
      { user: "U1", text: "keep", ts: "1" },
      { user: "U1", text: "drop", ts: "2", subtype: "channel_join" },
    ]);

    expect(result).toContain("keep");
    expect(result).not.toContain("drop");
  });
});
