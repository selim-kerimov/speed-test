import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeError,
  formatBytes,
  formatDuration,
  formatSpeed,
  progressBar,
  sparkline,
} from "../src/format.ts";

describe("formatBytes", () => {
  it("uses decimal units", () => {
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(999), "999 B");
    assert.equal(formatBytes(1000), "1.00 KB");
    assert.equal(formatBytes(1_500_000), "1.50 MB");
    assert.equal(formatBytes(2_000_000_000), "2.00 GB");
  });

  it("switches unit when rounding reaches 1000", () => {
    assert.equal(formatBytes(999_994), "999.99 KB");
    assert.equal(formatBytes(999_999), "1.00 MB");
    assert.equal(formatBytes(999_999_999), "1.00 GB");
  });

  it("does not go beyond GB", () => {
    assert.equal(formatBytes(5_000_000_000_000), "5000.00 GB");
  });
});

describe("formatDuration", () => {
  it("uses ms below one second and s above", () => {
    assert.equal(formatDuration(42.4), "42 ms");
    assert.equal(formatDuration(999), "999 ms");
    assert.equal(formatDuration(1250), "1.25 s");
  });

  it("switches to seconds when rounding reaches 1000 ms", () => {
    assert.equal(formatDuration(999.4), "999 ms");
    assert.equal(formatDuration(999.6), "1.00 s");
  });
});

describe("formatSpeed", () => {
  it("prints Mbit/s with two decimals", () => {
    assert.equal(formatSpeed(64.816), "64.82 Mbit/s");
  });
});

describe("progressBar", () => {
  it("fills proportionally to the fraction", () => {
    assert.equal(progressBar(0, 4), "░░░░");
    assert.equal(progressBar(0.5, 4), "██░░");
    assert.equal(progressBar(1, 4), "████");
  });

  it("clamps values outside 0..1", () => {
    assert.equal(progressBar(-1, 4), "░░░░");
    assert.equal(progressBar(2, 4), "████");
  });
});

describe("sparkline", () => {
  it("scales bars from 0 to the maximum", () => {
    assert.equal(sparkline([0, 4, 8]), "▁▅█");
  });

  it("shows equal values as full bars", () => {
    assert.equal(sparkline([5, 5, 5]), "███");
  });

  it("handles all zeros", () => {
    assert.equal(sparkline([0, 0]), "▁▁");
  });
});

describe("describeError", () => {
  it("adds the cause of a fetch error", () => {
    const error = new Error("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND x") });
    assert.equal(describeError(error), "fetch failed (getaddrinfo ENOTFOUND x)");
  });

  it("lists the reasons of an AggregateError cause (IPv6 + IPv4 both failed)", () => {
    const cause = new AggregateError([
      new Error("connect ECONNREFUSED ::1:80"),
      new Error("connect ECONNREFUSED 127.0.0.1:80"),
    ]);
    assert.equal(
      describeError(new Error("fetch failed", { cause })),
      "fetch failed (connect ECONNREFUSED ::1:80, connect ECONNREFUSED 127.0.0.1:80)",
    );
  });

  it("handles plain errors and non-errors", () => {
    assert.equal(describeError(new Error("HTTP 404 Not Found")), "HTTP 404 Not Found");
    assert.equal(describeError("oops"), "oops");
  });
});
