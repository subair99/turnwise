// Core safety rule: only the policy gate may talk to PayPal.
// Agents, routes, components and jobs must go through src/gate.
import next from "eslint-config-next";

export default [
  ...(Array.isArray(next) ? next : []),
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/gate/**", "src/paypal/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/paypal/*", "**/paypal/*"], message: "Only src/gate may import src/paypal. Send a typed proposal to the gate instead." },
            { group: ["@paypal/agent-toolkit", "@paypal/agent-toolkit/*"], message: "Use the allow-listed tools from src/gate/toolkit-allowlist.ts." }
          ]
        }
      ]
    }
  }
];
