import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "unicorn", "import", "node"],
  env: {
    node: true,
    es2024: true,
  },
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  rules: {
    eqeqeq: "error",
    "no-var": "error",
    "prefer-const": "error",
  },
  ignorePatterns: ["node_modules/**", "pnpm-lock.yaml"],
});
