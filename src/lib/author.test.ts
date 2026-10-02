import { describe, expect, it } from "vitest";
import { getAuthorAge, getAuthorProfileLabel } from "./author";

// テスト用の生年月日（実在の値ではない）
const BIRTHDATE = "2000-08-20";

describe("getAuthorAge", () => {
  it("誕生日の前日までは前の年齢", () => {
    // 2026-08-19 23:59 JST
    expect(getAuthorAge(new Date("2026-08-19T14:59:00Z"), BIRTHDATE)).toBe(25);
  });

  it("日本時間の誕生日当日0時から年齢が上がる", () => {
    // 2026-08-20 00:00 JST（UTCではまだ8/19）
    expect(getAuthorAge(new Date("2026-08-19T15:00:00Z"), BIRTHDATE)).toBe(26);
  });

  it("誕生月より後なら年齢が上がっている", () => {
    expect(getAuthorAge(new Date("2026-10-02T03:00:00Z"), BIRTHDATE)).toBe(26);
  });

  it("未設定・不正な値なら null", () => {
    const now = new Date("2026-10-02T03:00:00Z");
    expect(getAuthorAge(now, undefined)).toBeNull();
    expect(getAuthorAge(now, "")).toBeNull();
    expect(getAuthorAge(now, "2000/08/20")).toBeNull();
    expect(getAuthorAge(now, "2000-13-01")).toBeNull();
  });
});

describe("getAuthorProfileLabel", () => {
  it("年齢があれば「N歳・転職1回」", () => {
    expect(getAuthorProfileLabel(new Date("2026-10-02T03:00:00Z"), BIRTHDATE)).toBe(
      "26歳・転職1回"
    );
  });

  it("年齢が出せなければ「転職1回」だけ", () => {
    expect(getAuthorProfileLabel(new Date("2026-10-02T03:00:00Z"), "invalid")).toBe(
      "転職1回"
    );
  });
});
