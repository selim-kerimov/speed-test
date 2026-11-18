import { createInterface, type Interface } from "node:readline/promises";
import { styleText } from "node:util";
import {
  describeError,
  formatBytes,
  formatDuration,
  formatSpeed,
  progressBar,
  sparkline,
} from "./format.ts";
import type { RequestResult } from "./measure.ts";
import { mbitPerSec, type Summary } from "./stats.ts";

type Style = Parameters<typeof styleText>[0];

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_MS = 80;
const BAR_WIDTH = 20;

// ANSI escape codes: go to line start and clear it; hide/show the cursor.
const CLEAR_LINE = "\r\x1b[2K";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
// A wrapped live line can't be fully cleared, so cut it at the terminal edge instead.
const NO_WRAP = "\x1b[?7l";
const WRAP = "\x1b[?7h";

/** State of the request that is downloading right now. */
interface LiveRequest {
  index: number;
  total: number;
  startedAt: number;
  connected: boolean;
  bytes: number;
  totalBytes: number | undefined;
}

/** Colour for a speed value. Thresholds are a rough "slow / ok / fast" guide. */
function speedStyle(mbit: number): Style {
  if (mbit >= 100) return ["bold", "green"];
  if (mbit >= 20) return ["bold", "yellow"];
  return ["bold", "red"];
}

/**
 * Console output. In a terminal it animates a spinner and a progress bar;
 * when output is piped to a file it prints plain lines, and styleText drops the colours.
 */
export class Ui {
  private readonly out = process.stdout;
  private readonly animated = process.stdout.isTTY === true;
  private live: LiveRequest | undefined;
  private timer: NodeJS.Timeout | undefined;
  private frame = 0;
  private titleShown = false;

  /** Asks for a URL until `parse` stops throwing. */
  async askUrl(parse: (value: string) => string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: this.out });
    // readline swallows Ctrl+C, so the process-level handler doesn't fire here.
    rl.on("SIGINT", () => this.cancel(rl));

    this.write(`\n  ${this.title()}\n`);
    this.titleShown = true;
    this.write(
      this.paint("dim", "     Enter a URL to download, e.g. a large image or a test file") + "\n\n",
    );
    try {
      for (;;) {
        let answer: string;
        try {
          answer = await rl.question(`  ${this.paint("cyan", "›")} `);
        } catch {
          // Ctrl+D aborts the question.
          return this.cancel(rl);
        }
        try {
          return parse(answer);
        } catch (error) {
          this.write(`  ${this.paint("red", `✖ ${describeError(error)}`)}\n`);
        }
      }
    } finally {
      rl.close();
    }
  }

  header(url: string, count: number, timeoutMs: number): void {
    // After the prompt the title and the typed URL are already on screen.
    if (!this.titleShown) {
      this.write(`\n  ${this.title()}  ${this.paint("dim", "→")}  ${this.paint("cyan", url)}\n`);
    }
    this.write(
      this.paint(
        "dim",
        `     ${count} sequential request${count === 1 ? "" : "s"} · timeout ${timeoutMs / 1000} s`,
      ) + "\n\n",
    );
  }

  startRequest(index: number, total: number): void {
    this.live = {
      index,
      total,
      startedAt: performance.now(),
      connected: false,
      bytes: 0,
      totalBytes: undefined,
    };
    if (!this.animated) return;

    this.write(HIDE_CURSOR);
    this.draw();
    // Redraw on a timer rather than per chunk to keep rendering off the hot path.
    this.timer = setInterval(() => this.draw(), FRAME_MS);
  }

  progress(bytes: number, totalBytes: number | undefined): void {
    if (!this.live) return;
    this.live.connected = true;
    this.live.bytes = bytes;
    this.live.totalBytes = totalBytes;
  }

  finishRequest(result: RequestResult): void {
    const live = this.live;
    this.stopAnimation();
    if (!live) return;

    const speed = mbitPerSec(result.bytes, result.durationMs);
    this.write(
      `  ${this.paint("green", "✔")} ${this.label(live)}` +
        `  ${formatDuration(result.durationMs).padStart(8)}` +
        `  ${this.paint("dim", formatBytes(result.bytes).padStart(10))}` +
        `  ${this.paint(speedStyle(speed), formatSpeed(speed).padStart(14))}\n`,
    );
  }

  summary(s: Summary, results: RequestResult[]): void {
    const speeds = results.map((r) => mbitPerSec(r.bytes, r.durationMs));
    const row = (name: string, value: string) =>
      this.write(`  ${this.paint("dim", name.padEnd(14))}${value}\n`);

    this.write(`\n  ${this.paint("dim", "─".repeat(52))}\n`);
    row("Requests", String(s.count));
    row(
      "Average time",
      `${formatDuration(s.avgMs)}  ${this.paint("dim", `(min ${formatDuration(s.minMs)} · max ${formatDuration(s.maxMs)})`)}`,
    );
    row(
      "Total data",
      `${formatBytes(s.totalBytes)}  ${this.paint("dim", `(${s.totalBytes.toLocaleString("en-US")} bytes)`)}`,
    );
    row("Per request", this.paint("cyan", sparkline(speeds)));

    if (results.some((r) => r.compressed)) {
      this.write(
        `\n  ${this.paint("yellow", "⚠ The server compressed the response: sizes are counted after")}` +
          `\n  ${this.paint("yellow", "  decompression, so the speed below is overstated.")}\n`,
      );
    }

    const speed = this.paint(speedStyle(s.mbitPerSec), formatSpeed(s.mbitPerSec));
    const mb = this.paint("dim", `(${s.mbPerSec.toFixed(2)} MB/s)`);
    this.write(`\n  ${this.paint("bold", "⚡ Download speed")}  ${speed}  ${mb}\n\n`);
  }

  fail(error: unknown): void {
    this.stopAnimation();
    const err = process.stderr;
    err.write(
      `\n  ${styleText(["bold", "red"], `✖ Error: ${describeError(error)}`, { stream: err })}\n`,
    );
    err.write(`  ${styleText("dim", "Run with --help for usage.", { stream: err })}\n\n`);
  }

  interrupt(): void {
    this.stopAnimation();
    this.write(`\n  ${this.paint("yellow", "Interrupted.")}\n`);
  }

  private draw(): void {
    const live = this.live;
    if (!live) return;

    const spinner = this.paint("cyan", SPINNER[this.frame++ % SPINNER.length]);
    let details: string;
    if (!live.connected) {
      details = this.paint("dim", "connecting…");
    } else {
      const elapsed = performance.now() - live.startedAt;
      const speed = this.paint("dim", formatSpeed(mbitPerSec(live.bytes, elapsed)));
      if (live.totalBytes) {
        const fraction = live.bytes / live.totalBytes;
        const bar = this.paint("cyan", progressBar(fraction, BAR_WIDTH));
        const percent = `${Math.floor(fraction * 100)}%`.padStart(4);
        const size = `${formatBytes(live.bytes)} / ${formatBytes(live.totalBytes)}`;
        details = `${bar} ${percent}  ${size}  ${speed}`;
      } else {
        details = `${formatBytes(live.bytes)}  ${speed}`;
      }
    }
    this.write(`${CLEAR_LINE}${NO_WRAP}  ${spinner} ${this.label(live)}  ${details}${WRAP}`);
  }

  private stopAnimation(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    if (this.animated && this.live) {
      this.write(CLEAR_LINE + SHOW_CURSOR);
    }
    this.live = undefined;
  }

  private cancel(rl: Interface): never {
    rl.close();
    this.interrupt();
    process.exit(130);
  }

  private title(): string {
    return this.paint(["bold", "magenta"], "⚡ Speed test");
  }

  private label(live: LiveRequest): string {
    return this.paint("dim", `#${String(live.index).padStart(String(live.total).length)}`);
  }

  private paint(style: Style, text: string): string {
    return styleText(style, text, { stream: this.out });
  }

  private write(text: string): void {
    this.out.write(text);
  }
}
