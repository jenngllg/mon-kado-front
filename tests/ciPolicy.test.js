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
    expect(workflow).toContain("ref: ${{ github.head_ref == 'codex/MK-983-share-channels' && '171c4c79f372a3451f11632708d7d151703e201d' || github.head_ref == 'codex/MK-981-wish-sorting' && '00cc1c61190e11e26360b7bb9af0f83f8dc3a0d1' || 'develop' }}");
    expect(workflow).toContain("git -C .backend rev-parse HEAD");
    expect(workflow).toContain("up --detach caddy");
    expect(workflow).toContain("down --volumes --remove-orphans");
    expect(workflow).toContain("GOOGLE_AUTHENTICATION_ENABLED: 'false'");
  });
});
