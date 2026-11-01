import { readFileSync } from "node:fs";

const policyMatch = readFileSync(new URL("../deployments/caddy/Caddyfile", import.meta.url), "utf8")
  .match(/Content-Security-Policy "([^"]+)"/);
if (!policyMatch) throw new Error("The deployed CSP is required for browser tests.");
export const deployedPolicy = policyMatch[1].replaceAll("{$FRONTEND_API_ORIGIN}", "http://localhost:7000")
  .replaceAll("{$FRONTEND_SENTRY_ORIGIN}", "");
