import { parseArgs } from "node:util";

const DEFAULT_COUNT = 10;
const DEFAULT_TIMEOUT_MS = 30_000;
// Node timers cannot wait longer than 2^31 - 1 ms (~24.8 days): bigger values fire at once.
const MAX_TIMEOUT_MS = 2_147_483_647;

export interface Options {
  /** Undefined when no URL was passed: the caller may then ask for it interactively. */
  url: string | undefined;
  count: number;
  timeoutMs: number;
}

export const USAGE = `Usage: node src/index.ts [url] [--count N] [--timeout MS]

Without a URL the script asks for it interactively.

Options:
  -n, --count    number of sequential requests (default: ${DEFAULT_COUNT})
  -t, --timeout  timeout for a single request in ms (default: ${DEFAULT_TIMEOUT_MS})
  -h, --help     show this help`;

/** Parses command-line arguments. Returns `null` when help was requested. */
export function parseOptions(args: string[]): Options | null {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      count: { type: "string", short: "n", default: String(DEFAULT_COUNT) },
      timeout: { type: "string", short: "t", default: String(DEFAULT_TIMEOUT_MS) },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    return null;
  }
  if (positionals.length > 1) {
    throw new Error(`expected one URL, got ${positionals.length} arguments`);
  }

  return {
    url: positionals[0] === undefined ? undefined : parseUrl(positionals[0]),
    count: parsePositiveInt(values.count, "count"),
    timeoutMs: parsePositiveInt(values.timeout, "timeout", MAX_TIMEOUT_MS),
  };
}

/** Checks that the value is an http(s) URL and returns it normalized. */
export function parseUrl(value: string): string {
  if (!value.trim()) {
    throw new Error("URL is required");
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`invalid URL: "${value}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`only http and https URLs are supported, got "${url.protocol}"`);
  }
  return url.href;
}

function parsePositiveInt(value: string, name: string, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer, got "${value}"`);
  }
  if (parsed > max) {
    throw new Error(`--${name} must be at most ${max}, got "${value}"`);
  }
  return parsed;
}
