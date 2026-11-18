import type { Plugin, RuleOutcome, UserConfig } from "@commitlint/types";

// Only attribution is blocked; a message may still mention Claude.
const AI_ATTRIBUTION = [
  /^[\w-]+-by:.*\b(claude|anthropic)\b/im, // Co-authored-by: Claude <noreply@anthropic.com>
  /generated with .*\bclaude\b/i, // Generated with [Claude Code](...)
];

const noAiAuthor: Plugin = {
  rules: {
    "no-ai-author": ({ raw }): RuleOutcome => [
      !AI_ATTRIBUTION.some((pattern) => pattern.test(raw ?? "")),
      "commit message must not credit Claude/Anthropic as an author (no AI co-authors)",
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
