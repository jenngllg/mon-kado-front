import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/publish-bootstrap-frontend.yml", import.meta.url), "utf8");

describe("temporary registration frontend publication", () => {
  it("requires explicit protected approval and immutable matching revisions", () => {
    expect(workflow).toContain("default: false");
    expect(workflow).toContain("github.ref == 'refs/heads/develop' && inputs.temporary_test");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("required_reviewers");
    expect(workflow).toContain('for revision in "$GITHUB_SHA" "$FRONTEND_REVISION"');
    expect(workflow).toContain("2575facf0c96f212598ce73a5f3d283cea127a4c");
    expect(workflow).toContain("b2f94e05be57a7fe625840c4fbbae8e50af035c1");
    expect(workflow).toContain('test "$(jq -er');
    for (const action of workflow.matchAll(/uses: ([^\s]+)/g)) expect(action[1]).toMatch(/@[a-f0-9]{40}$/);
  });

  it("verifies the actual API and all frontend gates without weakening backend deployment", () => {
    for (const command of ["pnpm lint", "pnpm typecheck", "pnpm test:coverage", "pnpm api:types:check", "pnpm test:e2e", "pnpm build"])
      expect(workflow).toContain(command);
    expect(workflow).toContain("MONKADO_OPENAPI_URL: https://api.monkado.fr/openapi/v1.json");
    expect(workflow).toContain("VITE_GOOGLE_AUTH_ENABLED: 'false'");
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("systemctl");
    expect(workflow).not.toContain("legalApproved: true");
    expect(workflow).toContain('cmp "$RUNNER_TEMP/existing-frontend/manifest.json"');
    expect(workflow).toContain('cmp "$RUNNER_TEMP/existing-frontend/frontend.tar.gz"');
  });
});
