import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mbitPerSec, summarize } from "../src/stats.ts";

describe("summarize", () => {
  it("computes totals, average, min and max", () => {
    const s = summarize([
      { bytes: 1_000_000, durationMs: 100 },
      { bytes: 1_000_000, durationMs: 300 },
      { bytes: 2_000_000, durationMs: 200 },
    ]);

    assert.equal(s.count, 3);
    assert.equal(s.totalBytes, 4_000_000);
    assert.equal(s.totalMs, 600);
    assert.equal(s.avgMs, 200);
    assert.equal(s.minMs, 100);
    assert.equal(s.maxMs, 300);
  });

  it("computes speed as total bytes over total time", () => {
    // 10 MB in 2 seconds = 5 MB/s = 40 Mbit/s
    const s = summarize([
      { bytes: 5_000_000, durationMs: 1000 },
      { bytes: 5_000_000, durationMs: 1000 },
    ]);

    assert.equal(s.mbPerSec, 5);
    assert.equal(s.mbitPerSec, 40);
  });

  it("throws on empty input", () => {
    assert.throws(() => summarize([]), /no results/);
  });
});

describe("mbitPerSec", () => {
  it("converts bytes and milliseconds to Mbit/s", () => {
    // 1 MB in 0.5 s = 2 MB/s = 16 Mbit/s
    assert.equal(mbitPerSec(1_000_000, 500), 16);
  });
});
