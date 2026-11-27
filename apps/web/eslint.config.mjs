// ESLint flat config (T-62). eslint-config-next 15 ships eslintrc presets, so FlatCompat bridges them.
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // `const { omitted, ...rest } = obj` is how this codebase drops a key; the omitted name is unused on purpose.
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }] } },
  // e2e-paid specs get the retry-on-dropped-socket fixture (e2e-paid/fixtures.ts); importing Playwright directly would skip it
  { files: ["e2e-paid/**/*.spec.ts"], rules: { "no-restricted-imports": ["error", { paths: [{ name: "@playwright/test", message: 'Import { test, expect } from "./fixtures" (retries a dropped keep-alive socket once).' }] }] } },
];

export default config;
