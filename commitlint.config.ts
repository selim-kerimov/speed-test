import type { Plugin, RuleOutcome, UserConfig } from "@commitlint/types";

// Matches any mention of Claude / Anthropic in the commit message,
// e.g. "Co-Authored-By: Claude <noreply@anthropic.com>".
const AI_AUTHOR_PATTERN = /claude|anthropic/i;

const noAiAuthor: Plugin = {
  rules: {
    "no-ai-author": ({ raw }): RuleOutcome => [
      !AI_AUTHOR_PATTERN.test(raw ?? ""),
      "commit message must not mention Claude/Anthropic (no AI co-authors)",
    ],
  },
};

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  plugins: [noAiAuthor],
  rules: {
    "no-ai-author": [2, "always"],
  },
};

export default config;
