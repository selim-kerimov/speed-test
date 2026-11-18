# AGENTS.md

CLI that measures download speed: N sequential requests to a URL, then average time, total bytes and speed.

## Stack

- TypeScript, run directly by Node 24+ (type stripping, no build step).
- No runtime dependencies. Use Node built-ins only (`fetch`, `node:util`, `node:readline`, `node:test`).
- pnpm for dev tooling.

## Commands

```bash
node src/index.ts <url>   # run
pnpm test                 # node:test, no network needed
pnpm typecheck            # tsc
pnpm lint                 # oxlint
pnpm format               # oxfmt
```

Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before committing. The pre-commit hook runs the same checks.

## Layout

- `src/index.ts`: entry point, request loop, error handling
- `src/cli.ts`: argument parsing and validation
- `src/measure.ts`: a single request: download the body, measure time
- `src/stats.ts`: totals, average, speed
- `src/format.ts`: pure formatting helpers
- `src/ui.ts`: console output (colors, animation, URL prompt)
- `test/`: one test file per module

## Rules

- Erasable TypeScript only (`erasableSyntaxOnly`): no `enum`, `namespace` or parameter properties.
- Relative imports use the `.ts` extension: `import { x } from "./stats.ts"`.
- Keep `format.ts`, `stats.ts` and `cli.ts` pure and cover them with tests. All console output goes through `ui.ts`.
- Tests must not use the internet: spin up a local `node:http` server.
- Speed units are decimal (SI): 1 Mbit = 1 000 000 bits. Update the README if units or output change.
- Commits follow Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Do not add AI attribution to commits (`Co-authored-by`, `Generated with ...`). commitlint rejects it.
