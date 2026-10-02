import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { stripSlackMention, verifySlackSignature } from "./slack";

function sign(secret: string, timestamp: string, rawBody: string): string {
  const digest = createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex");
  return `v0=${digest}`;
}

describe("verifySlackSignature", () => {
  const secret = "test-signing-secret";
  const now = 1_800_000_000;
  const timestamp = String(now);
  const rawBody = JSON.stringify({ type: "event_callback" });

  it("accepts a valid recent signature", () => {
    expect(
      verifySlackSignature({
        rawBody,
        timestamp,
        signature: sign(secret, timestamp, rawBody),
        signingSecret: secret,
        nowSeconds: now,
      })
    ).toBe(true);
  });

  it("rejects a stale timestamp", () => {
    const staleTimestamp = String(now - 301);
    expect(
      verifySlackSignature({
        rawBody,
        timestamp: staleTimestamp,
        signature: sign(secret, staleTimestamp, rawBody),
        signingSecret: secret,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it("rejects a bad signature", () => {
    expect(
      verifySlackSignature({
        rawBody,
        timestamp,
        signature: "v0=bad",
        signingSecret: secret,
        nowSeconds: now,
      })
    ).toBe(false);
  });
});

describe("stripSlackMention", () => {
  it("removes Slack mention markup and normalizes whitespace", () => {
    expect(stripSlackMention("<@U123ABC>   Claudeと相談して  SEO直して"))
      .toBe("Claudeと相談して SEO直して");
  });
});
