import { parseOptions, parseUrl, USAGE } from "./cli.ts";
import { measureRequest, type RequestResult } from "./measure.ts";
import { summarize } from "./stats.ts";
import { Ui } from "./ui.ts";

async function main(ui: Ui): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options) {
    console.log(USAGE);
    return;
  }

  const { count, timeoutMs } = options;
  let url = options.url;
  if (url === undefined) {
    // Without a terminal the prompt would be invisible and the script would hang.
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error("URL is required");
    }
    url = await ui.askUrl(parseUrl);
  }
  ui.header(url, count, timeoutMs);

  const results: RequestResult[] = [];
  for (let i = 1; i <= count; i++) {
    ui.startRequest(i, count);
    const result = await measureRequest(url, timeoutMs, (bytes, total) =>
      ui.progress(bytes, total),
    );
    ui.finishRequest(result);
    results.push(result);
  }

  ui.summary(summarize(results), results);
}

const ui = new Ui();

// The cursor is hidden during animation, so restore it on Ctrl+C.
process.once("SIGINT", () => {
  ui.interrupt();
  process.exit(130);
});

main(ui).catch((error: unknown) => {
  ui.fail(error);
  process.exitCode = 1;
});
