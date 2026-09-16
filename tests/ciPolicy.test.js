import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");

describe("frontend CI contract", () => {
  it("runs all quality gates with immutable action revisions and no privileged PR trigger", () => {
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).not.toContain("secrets.");
    for (const action of workflow.matchAll(/uses: ([^\s]+)/g)) expect(action[1]).toMatch(/@[a-f0-9]{40}$/);
    for (const command of ["pnpm install --frozen-lockfile", "pnpm lint", "pnpm typecheck", "pnpm test:coverage", "pnpm build", "pnpm test:e2e", "pnpm api:types:check"])
      expect(workflow).toContain(command);
    expect(workflow).toContain("needs: [quality, contract]");
    expect(workflow).toContain('test "$QUALITY_RESULT" = success && test "$CONTRACT_RESULT" = success');
  });

  it("checks a clean backend revision with disposable resources and no worker", () => {
    expect(workflow).toContain("repository: jenngllg/mon-kado");
    expect(workflow).toContain("ref: develop");
    expect(workflow).toContain("git -C .backend rev-parse HEAD");
    expect(workflow).toContain("up --detach caddy");
    expect(workflow).toContain("down --volumes --remove-orphans");
    expect(workflow).toContain("GOOGLE_AUTHENTICATION_ENABLED: 'false'");
  });
});
