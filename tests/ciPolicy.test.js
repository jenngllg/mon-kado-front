import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");

describe("frontend CI contract", () => {
  it.each([
    ["brace-expansion@^2.0.0", "brace-expansion", "2.1.7", "2.1.4"],
    ["brace-expansion@^5.0.0", "brace-expansion", "5.0.12", "5.0.9"],
    ["source-map-js", "source-map-js", "1.2.2", "1.2.1"],
  ])("keeps the patched %s resolution in the frozen install", (selector, name, patched, vulnerable) => {
    // Arrange
    const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
    const lock = readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");

    // Act / Assert
    expect(workspace).toContain(`"${selector}": "${patched}"`);
    expect(lock).toContain(`${name}@${patched}:`);
    expect(lock).not.toContain(`${name}@${vulnerable}:`);
  });

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
    expect(workflow).toContain("ref: ${{ github.head_ref == 'codex/MK-1008-frontend-native-contract' && '84e665b570694fc829869494d2c04999778e09ff' || 'develop' }}");
    expect(workflow).toContain("git -C .backend rev-parse HEAD");
    expect(workflow).toContain(".backend/scripts/Initialize-CIPostgres.sh");
    expect(workflow).toContain("./cmd/api");
    expect(workflow).toContain("./cmd/migrate");
    expect(workflow).toContain("pg_dropcluster --stop 18 monkado");
    expect(workflow).toContain("GOOGLE_ENABLED: 'false'");
    expect(workflow).not.toContain("docker compose");
    expect(workflow).not.toContain("./cmd/worker");
    expect(workflow).toContain("pnpm api:types:check");
  });
});
