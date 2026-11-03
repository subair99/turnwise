// Core safety rule: only the policy gate may talk to PayPal.
// Agents, routes, components and jobs must go through src/gate.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "prisma/migrations/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    // Sandbox diagnostics read raw PayPal JSON; app code stays strict.
    files: ["scripts/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/gate/**", "src/paypal/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/paypal/*", "**/paypal/*"], message: "Only src/gate may import src/paypal. Send a typed proposal to the gate instead." },
            { group: ["@paypal/agent-toolkit", "@paypal/agent-toolkit/*"], message: "Use the allow-listed tools from src/gate/toolkit-allowlist.ts." },
          ],
        },
      ],
    },
  },
];

export default config;
