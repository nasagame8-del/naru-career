/**
 * Resilience tests for the crawl plumbing shared by Stage 4 and Stage 5.
 *
 * The 3,419-company run died once at company 627 with "TypeError: terminated",
 * thrown by undici while streaming a response body rather than by fetch()
 * itself. These tests pin the two guards that keep one dropped connection from
 * ending a multi-thousand-item run:
 *
 *   1. a mid-body disconnect becomes an error on that one page
 *   2. an unexpected throw inside a pool worker is reported for that item only
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { fetchDocument, getRobots, runPool } from "./research-web.mjs";

const FAST = { sameHostDelayMs: 1, timeoutMs: 5_000, maxAttempts: 1 };

/**
 * A server that answers /ok normally and drops the connection mid-body on
 * /drop, which is what a real host doing this to us looks like to undici.
 * `dropRobots` makes robots.txt itself die the same way.
 *
 * The disconnect is deferred so the client receives the headers first and
 * fetch() resolves. Destroying the socket in the same tick kills the response
 * before its headers land, which undici reports from fetch() instead — a
 * different path, already covered by the catch around the request itself.
 */
async function startServer({ dropRobots = false } = {}) {
  const dropAfterHeaders = (res, head, partial) => {
    res.writeHead(200, head);
    res.write(partial);
    setTimeout(() => res.socket?.destroy(), 100);
  };
  const server = http.createServer((req, res) => {
    if (req.url === "/robots.txt") {
      if (!dropRobots) {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("User-agent: *\nAllow: /\n");
        return;
      }
      // Promise a long body, then disconnect part-way through it.
      dropAfterHeaders(res, { "content-type": "text/plain", "content-length": "200" }, "User-agent: *\n");
      return;
    }
    if (req.url === "/drop") {
      dropAfterHeaders(
        res,
        { "content-type": "text/html", "content-length": "100000" },
        "<html><head><title>partial</title></head><body>",
      );
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html><head><title>fine</title></head><body><a href='/recruit/'>採用情報</a></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("fetchDocument reports a mid-body disconnect instead of throwing", async () => {
  const srv = await startServer();
  try {
    const out = await fetchDocument(`${srv.base}/drop`, FAST);
    assert.equal(out.ok, false);
    assert.match(out.error, /^body_read_failed:/, `unexpected error: ${out.error}`);
    assert.equal(out.httpStatus, 200);
    assert.equal(out.html, null, "a failed body read must not leave partial html behind");
    // The failure is scoped to the page: the next fetch on the same host works.
    const good = await fetchDocument(`${srv.base}/ok`, FAST);
    assert.equal(good.ok, true);
    assert.match(good.html, /fine/);
  } finally {
    await srv.close();
  }
});

test("getRobots degrades to unavailable when robots.txt body read fails", async () => {
  const srv = await startServer({ dropRobots: true });
  try {
    const robots = await getRobots(srv.base, FAST);
    assert.equal(robots.status, "unavailable");
    assert.equal(robots.note, "robots_body_read_failed");
    // Unavailable robots must not block the page itself.
    const out = await fetchDocument(`${srv.base}/ok`, FAST);
    assert.equal(out.robotsStatus, "unavailable");
    assert.equal(out.ok, true);
  } finally {
    await srv.close();
  }
});

test("runPool routes a thrown item to onItemError and finishes the rest", async () => {
  const seen = [];
  const results = await runPool(
    [1, 2, 3, 4, 5],
    2,
    async (n) => {
      if (n === 3) throw Object.assign(new TypeError("terminated"), { cause: { code: "UND_ERR_SOCKET" } });
      return { n, ok: true };
    },
    (n, err) => {
      seen.push([n, err.name, err.message]);
      return { n, ok: false, error: `unhandled:${err.name}` };
    },
  );

  assert.equal(results.length, 5);
  assert.deepEqual(seen, [[3, "TypeError", "terminated"]]);
  assert.deepEqual(results.map((r) => r.n), [1, 2, 3, 4, 5], "results stay aligned with their inputs");
  assert.deepEqual(results.filter((r) => r.ok).map((r) => r.n), [1, 2, 4, 5]);
  assert.equal(results[2].error, "unhandled:TypeError");
});

test("runPool still rejects when no onItemError handler is supplied", async () => {
  await assert.rejects(
    runPool([1, 2], 1, async (n) => { if (n === 2) throw new TypeError("terminated"); return n; }),
    /terminated/,
  );
});

test("a pool over real pages records every item, dropped body included", async () => {
  const srv = await startServer();
  try {
    const targets = [`${srv.base}/ok`, `${srv.base}/drop`, `${srv.base}/ok?2`, "http://127.0.0.1:1/dead"];
    const records = await runPool(
      targets,
      2,
      async (url) => {
        const doc = await fetchDocument(url, FAST);
        if (doc.error) throw new Error(doc.error); // force the guard to carry it
        return { url, status: "completed", httpStatus: doc.httpStatus };
      },
      (url, err) => ({ url, status: "failed", httpStatus: null, error: err.message }),
    );

    // The completion condition for the full run: every input ends up either
    // completed or explicitly recorded as failed, and nothing is silently lost.
    assert.equal(records.length, targets.length);
    assert.equal(records.filter((r) => r.status === "completed").length, 2);
    const failed = records.filter((r) => r.status === "failed");
    assert.equal(failed.length, 2);
    assert.match(failed[0].error, /^body_read_failed:/);
    // Unreached values stay null rather than being coerced to 0.
    assert.equal(failed[0].httpStatus, null);
  } finally {
    await srv.close();
  }
});
