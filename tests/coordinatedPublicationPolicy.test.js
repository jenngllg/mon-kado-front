import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/stage-coordinated-frontend.yml", import.meta.url), "utf8");
const quality = readFileSync(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");

describe("coordinated frontend publication policy", () => {
  it("requires automatic main-only production and the successful exact frontend quality run", () => {
    expect(workflow).toContain("environment: production");
    expect(workflow).not.toContain("required_reviewers");
    expect(workflow).toContain('select(.type != "branch_policy")');
    expect(workflow).toContain('[{"name":"main","type":"branch"}]');
    expect(workflow).toContain("quality.yml/runs?head_sha=$RELEASE_REVISION&branch=main");
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("VPS_DEPLOY_SSH_KEY");
    expect(workflow).not.toContain("refs/heads/develop");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("continue-on-error");
    for (const action of workflow.matchAll(/uses: ([^\s]+)/g)) expect(action[1]).toMatch(/@[a-f0-9]{40}$/);
  });

  it("binds the protected backend, tested OpenAPI bytes and immutable proof to the frontend", () => {
    expect(workflow).toContain("repos/jenngllg/mon-kado/releases/tags/backend-production");
    expect(workflow).toContain("ref: ${{ steps.backend.outputs.revision }}");
    expect(quality).toContain("cmp \"$RUNNER_TEMP/contract.json\" .backend/internal/httpapi/specification.json");
    expect(quality).toContain("pnpm api:types:check");
    expect(workflow).toContain("--name frontend-production-build");
    expect(workflow).toContain("--name frontend-backend-proof");
    expect(workflow).toContain(".backend/internal/httpapi/specification.json");
    expect(workflow).toContain("retain_assets.py");
    expect(workflow).not.toContain("run: pnpm build");
    for (const field of ["frontendRevision", "backendRevision", "configurationHash", "openapiSha256"])
      expect(workflow).toContain(field);
    expect(workflow).toContain("coordinated-proof.json");
    expect(workflow).toContain("cmp \"$RUNNER_TEMP/backend-before.json\" \"$RUNNER_TEMP/backend-after.json\"");
  });
});
