/** Formats a byte count with decimal (SI) units: 1 KB = 1000 B. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  // Compare the rounded value, otherwise 999 999 B would print as "1000.00 KB".
  while (unit < units.length - 1 && Number(value.toFixed(2)) >= 1000) {
    value /= 1000;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

/** "850 ms" below one second, "1.25 s" above. */
export function formatDuration(ms: number): string {
  const rounded = Math.round(ms);
  return rounded < 1000 ? `${rounded} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export function formatSpeed(mbit: number): string {
  return `${mbit.toFixed(2)} Mbit/s`;
}

/** Text progress bar, e.g. progressBar(0.5, 10) → "█████░░░░░". */
export function progressBar(fraction: number, width: number): string {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const filled = Math.round(clamped * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

const SPARK_CHARS = "▁▂▃▄▅▆▇█";

/**
 * Mini bar chart in one line, e.g. sparkline([1, 4, 8]) → "▂▅█".
 * Bars are scaled from 0 to the maximum, so small differences are not exaggerated.
 */
export function sparkline(values: number[]): string {
  const max = Math.max(...values);
  const top = SPARK_CHARS.length - 1;
  return values.map((v) => SPARK_CHARS[max > 0 ? Math.round((v / max) * top) : 0]).join("");
}

/** Error message for the user; fetch() hides the real network reason in `cause`. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const reason = describeCause(error.cause);
  return reason ? `${error.message} (${reason})` : error.message;
}

function describeCause(cause: unknown): string | undefined {
  // When both IPv6 and IPv4 fail, the cause is an AggregateError with an empty message
  // and the real reasons inside `errors`.
  if (cause instanceof AggregateError) {
    return cause.errors.map((e) => (e instanceof Error ? e.message : String(e))).join(", ");
  }
  return cause instanceof Error ? cause.message : undefined;
}
