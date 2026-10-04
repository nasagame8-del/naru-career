import { describe, expect, it } from "vitest";
import { evaluateArticleSlot, evaluateRun } from "./evaluate";
import {
  createEmptyManifest,
  manifestPath,
  manifestToRunFacts,
  normalizeManifest,
  parseManifest,
  reconcileRunManifest,
  serializeManifest,
} from "./manifest";
import type { EditorRunManifest } from "./manifest";

const D = "2026-10-04";
const gate = (sha: string) => ({ passed: true, headSha: sha });

describe("editor-agent manifest", () => {
  it("1. empty manifest", () => {
    const m = createEmptyManifest(D);
    expect(m).toEqual({
      schemaVersion: 1,
      date: D,
      candidatesReady: false,
      blockers: [],
      slots: { "1": { order: 1 }, "2": { order: 2 } },
    });
    expect(manifestPath(D)).toBe("data/editor-agent/run-2026-10-04.json");
    expect(evaluateRun(manifestToRunFacts(m)).state).toBe("CANDIDATE_RESEARCH_PENDING");
  });

  it("2. validation/serialization round trip is deterministic", () => {
    const m = reconcileRunManifest(createEmptyManifest(D), {
      candidatesReady: true,
      slots: { "1": { slug: "a", candidateId: "c1", selected: true, images: { card: { ref: "x" } } } },
      reconciledAt: "2026-10-04T00:00:00Z",
    });
    const json = serializeManifest(m);
    expect(json.endsWith("\n")).toBe(true);
    expect(parseManifest(json)).toEqual(m);
    expect(serializeManifest(parseManifest(json))).toBe(json);
    const shuffled = JSON.stringify({ slots: m.slots, date: m.date, schemaVersion: 1, candidatesReady: true, blockers: [], lastReconciledAt: m.lastReconciledAt });
    expect(serializeManifest(parseManifest(shuffled))).toBe(json);
  });

  it("3. partial evidence preserves known data", () => {
    const a = reconcileRunManifest(createEmptyManifest(D), {
      candidatesReady: true,
      slots: { "1": { candidateId: "c1", slug: "s", selected: true, branch: "b" } },
    });
    const b = reconcileRunManifest(a, { slots: { "1": { prNumber: 7, slug: null, branch: null, selected: false } } });
    expect(b.candidatesReady).toBe(true);
    expect(b.slots["1"]).toMatchObject({ candidateId: "c1", slug: "s", selected: true, branch: "b", prNumber: 7 });
  });

  it("4. identity conflict rejects", () => {
    const a = reconcileRunManifest(createEmptyManifest(D), { slots: { "1": { candidateId: "c1", articleId: "a1", slug: "s" } } });
    expect(() => reconcileRunManifest(a, { slots: { "1": { candidateId: "c2" } } })).toThrow(/candidateId conflict/);
    expect(() => reconcileRunManifest(a, { slots: { "1": { articleId: "a2" } } })).toThrow(/articleId conflict/);
    expect(() => reconcileRunManifest(a, { slots: { "1": { slug: "t" } } })).toThrow(/slug conflict/);
    expect(reconcileRunManifest(a, { slots: { "1": { slug: "s" } } })).toEqual(a);
  });

  it("5. image refs merge independently", () => {
    let m = reconcileRunManifest(createEmptyManifest(D), { slots: { "1": { images: { card: { ref: "c" } } } } });
    m = reconcileRunManifest(m, { slots: { "1": { images: { "02": { ref: "i2" } } } } });
    m = reconcileRunManifest(m, { slots: { "1": { images: { card: null } } } });
    expect(m.slots["1"].images).toEqual({ card: { ref: "c" }, "02": { ref: "i2" } });
  });

  it("6. head change leaves stale gates ineffective under evaluator", () => {
    const ready = reconcileRunManifest(createEmptyManifest(D), {
      candidatesReady: true,
      slots: {
        "1": {
          candidateId: "c1", selected: true, slug: "s", branch: "b", prNumber: 1, draftReady: true,
          latestHeadSha: "aaa",
          images: { card: { ref: "1" }, "01": { ref: "2" }, "02": { ref: "3" }, "03": { ref: "4" } },
          imageQa: gate("aaa"), factCheck: gate("aaa"), articleQa: gate("aaa"), ci: gate("aaa"), previewApprovedHeadSha: "aaa",
        },
      },
    });
    expect(evaluateArticleSlot(ready.slots["1"]).state).toBe("READY_TO_SCHEDULE");
    const moved = reconcileRunManifest(ready, { slots: { "1": { latestHeadSha: "bbb" } } });
    expect(moved.slots["1"].imageQa).toEqual(gate("aaa"));
    expect(moved.slots["1"].factCheck).toEqual(gate("aaa"));
    const r = evaluateArticleSlot(moved.slots["1"]);
    expect(r.state).toBe("IMAGE_QA");
    expect(r.state).not.toBe("READY_TO_SCHEDULE");
  });

  it("7. blocker omission preserves", () => {
    let m = reconcileRunManifest(createEmptyManifest(D), { blockers: ["run-b"], slots: { "2": { blockers: ["s-b"] } } });
    m = reconcileRunManifest(m, { candidatesReady: true, slots: { "2": { slug: "x" } } });
    expect(m.blockers).toEqual(["run-b"]);
    expect(m.slots["2"].blockers).toEqual(["s-b"]);
    m = reconcileRunManifest(m, { blockers: ["run-c", "run-b"] });
    expect(m.blockers).toEqual(["run-b", "run-c"]);
  });

  it("8. explicit blocker replacement clears/resolves", () => {
    let m = reconcileRunManifest(createEmptyManifest(D), { blockers: ["a", "b"], slots: { "1": { blockers: ["x"] } } });
    m = reconcileRunManifest(m, { replaceBlockers: ["b"], slots: { "1": { replaceBlockers: [] } } });
    expect(m.blockers).toEqual(["b"]);
    expect(m.slots["1"].blockers).toEqual([]);
    m = reconcileRunManifest(m, { replaceBlockers: [] });
    expect(m.blockers).toEqual([]);
  });

  it("9. two slots independent", () => {
    const m = reconcileRunManifest(createEmptyManifest(D), {
      slots: { "1": { candidateId: "c1", slug: "one" }, "2": { candidateId: "c2", slug: "two", selected: true } },
    });
    expect(m.slots["1"].selected).toBeUndefined();
    expect(m.slots["2"].selected).toBe(true);
    const n = reconcileRunManifest(m, { slots: { "1": { selected: true } } });
    expect(n.slots["2"]).toEqual(m.slots["2"]);
    expect(n.slots["1"].slug).toBe("one");
  });

  it("10. repeated reconciliation is idempotent", () => {
    const ev = {
      candidatesReady: true,
      blockers: ["b"],
      slots: { "1": { candidateId: "c1", selected: true, blockers: ["x"], images: { card: { ref: "r" } }, timestamps: { t: "1" } } },
      reconciledAt: "2026-10-04T01:00:00Z",
    };
    const once = reconcileRunManifest(createEmptyManifest(D), ev);
    const twice = reconcileRunManifest(once, ev);
    expect(serializeManifest(twice)).toBe(serializeManifest(once));
  });

  it("11. malformed date/schema rejected", () => {
    expect(() => createEmptyManifest("2026-13-01")).toThrow(/date/);
    expect(() => createEmptyManifest("2026-02-30")).toThrow(/date/);
    expect(() => normalizeManifest({ schemaVersion: 2, date: D })).toThrow(/schemaVersion/);
    expect(() => normalizeManifest({ date: D })).toThrow(/schemaVersion/);
    expect(() => normalizeManifest({ schemaVersion: 1, date: "10/04/2026" })).toThrow(/date/);
    expect(() => normalizeManifest({ schemaVersion: 1, date: D, blockers: "x" })).toThrow(/blockers/);
    expect(() => normalizeManifest({ schemaVersion: 1, date: D, slots: { "1": { order: 2 } } })).toThrow(/order/);
    expect(() => normalizeManifest({ schemaVersion: 1, date: D, slots: { "1": { prNumber: "7" } } })).toThrow(/prNumber/);
    expect(() => parseManifest("{nope")).toThrow(/invalid JSON/);
  });

  it("12. legacy/absent optional fields normalize safely", () => {
    const m: EditorRunManifest = normalizeManifest({
      schemaVersion: 1,
      date: D,
      futureField: { x: 1 },
      slots: { "1": { slug: null, extra: true, images: { card: null, "01": { ref: "a", note: "z" } } } },
    });
    expect(m.candidatesReady).toBe(false);
    expect(m.blockers).toEqual([]);
    expect(m.slots["2"]).toEqual({ order: 2 });
    expect(m.slots["1"]).toEqual({ order: 1, images: { "01": { ref: "a" } } });
    expect(m).not.toHaveProperty("futureField");
    expect(m.lastReconciledAt).toBeUndefined();
  });
});
