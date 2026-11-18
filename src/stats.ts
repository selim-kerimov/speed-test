import type { RequestResult } from "./measure.ts";

export interface Summary {
  count: number;
  totalBytes: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  /** Megabits per second (1 Mbit = 1 000 000 bits). */
  mbitPerSec: number;
  /** Megabytes per second (1 MB = 1 000 000 bytes). */
  mbPerSec: number;
}

/** Speed in Mbit/s for `bytes` downloaded in `ms` milliseconds. */
export function mbitPerSec(bytes: number, ms: number): number {
  return (bytes * 8) / (ms / 1000) / 1_000_000;
}

export function summarize(results: RequestResult[]): Summary {
  if (results.length === 0) {
    throw new Error("no results to summarize");
  }

  const durations = results.map((r) => r.durationMs);
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);
  const totalMs = durations.reduce((sum, d) => sum + d, 0);
  const speed = mbitPerSec(totalBytes, totalMs);

  return {
    count: results.length,
    totalBytes,
    totalMs,
    avgMs: totalMs / results.length,
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
    mbitPerSec: speed,
    mbPerSec: speed / 8,
  };
}
