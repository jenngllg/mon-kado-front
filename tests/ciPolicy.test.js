import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");

describe("frontend CI contract", () => {
  it("blocks publication on real native journeys and retains diagnostics without mailbox credentials", () => {
    const native = workflow.replace(/\r\n/g, "\n").split("  native-browser:\n")[1]?.split("\n  gate:")[0];
    expect(native).toContain("pnpm test:e2e:native");
    expect(native).toContain("MONKADO_BACKEND_SOURCE: ${{ github.workspace }}/.backend");
    expect(native).toContain("python3 -m unittest discover -s tools/native-e2e");
    expect(native).toContain("if: always()");
    expect(native).toContain("pg_dropcluster --stop 18 monkado");
    expect(native).toContain("include-hidden-files: true");
    expect(native).not.toContain("mailbox/");
    expect(native).not.toContain("fixture.json");
    const runner = readFileSync(new URL("../tools/native-e2e/run.py", import.meta.url), "utf8");
    expect(runner).toContain('for component in ("api", "worker", "migrate")');
    expect(runner).toContain('"EMAIL_PROVIDER": "Mailbox"');
    expect(runner).toContain('"GOOGLE_ENABLED": "false"');
  });

  it("publishes its checked pointer before waiting outside the VPS deployment lock", () => {
    const publication = readFileSync(new URL("../.github/workflows/stage-coordinated-frontend.yml", import.meta.url), "utf8");
    const publish = publication.indexOf("      - name: Publish immutable build before changing the production pointer");
    const wait = publication.indexOf("      - name: Wait for both checked main publications");
    const deploy = publication.indexOf("      - name: Deploy the approved main revision to the VPS");
    expect(publish).toBeGreaterThan(0);
    expect(wait).toBeGreaterThan(publish);
    expect(deploy).toBeGreaterThan(wait);
    expect(publication).toContain('python3 .backend/scripts/wait_paired_publication.py frontend "$RELEASE_REVISION"');
    expect(publication).toContain('test "$(jq -er .backendRevision "$RUNNER_TEMP/verified-contract/proof.json")" = "$BACKEND_REVISION"');
    expect(publication).toContain("timeout-minutes: 60");
    expect(publication).toContain("BACKEND_PUBLICATION_WAIT_SECONDS: '2400'");
    expect(publication).toContain("failure|cancelled|timed_out|action_required|stale|skipped) echo 'BACKEND_CHECKS_FAILED'; exit 1");
  });

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
    for (const command of ["pnpm install --frozen-lockfile", "pnpm lint", "pnpm typecheck", "pnpm test:coverage", "pnpm build", "pnpm test:e2e", "pnpm test:e2e:native", "pnpm api:types:check"])
      expect(workflow).toContain(command);
    expect(workflow).toContain("needs: [quality, contract, browser, native-browser]");
    expect(workflow).toContain('NATIVE_BROWSER_RESULT: ${{ needs.native-browser.result }}');
    expect(workflow).toContain('test "$QUALITY_RESULT" = success && test "$CONTRACT_RESULT" = success && test "$BROWSER_RESULT" = success && test "$NATIVE_BROWSER_RESULT" = success');
    expect(workflow).toContain("fail-fast: false");
    expect(workflow).toContain("shard: [1, 2, 3, 4]");
    expect(workflow).toContain("pnpm test:e2e --shard=${{ matrix.shard }}/4");
    expect(workflow).toContain("BROWSER_RESULT: ${{ needs.browser.result }}");
  });

  it("checks a clean backend revision with disposable resources and no worker", () => {
    expect(workflow).toContain("repository: jenngllg/mon-kado");
    expect(workflow).toContain("ref: ${{ github.head_ref == 'codex/all-local-production-20261106' && '2d55a4805b5652b75b6d534aac014f9d6339694c' || github.head_ref == 'codex/all-local-production-20261104' && '8ac07df638bab754e546311b71a2f0ffe11b4ea3' || github.head_ref == 'codex/notification-preferences' && 'b0912a13b5fe0c6ac9d3b631a0cfd2f4b19fadaa' || github.head_ref == 'codex/compatible-session-loading' && 'eec6c078d60ef28c6f3659575b69fbaef8997827' || github.head_ref == 'codex/notifications-responsive-production-20261103' && 'f38093556273520662e6a40a916d00c5099d480c' || github.head_ref == 'codex/image-pipeline-production' && '5c86bac103a10d07758dfe52f15c2c423380944b' || github.head_ref == 'codex/extension-surprise-release' && '296fccc09b5f30ef6fa1ed3e2b4a57399fb75cff' || github.head_ref == 'codex/complete-production-20261101' && '52aa836576681118262b723987cdcbf4773b13a2' || github.head_ref == 'codex/MK-1008-frontend-native-contract' && '84e665b570694fc829869494d2c04999778e09ff' || github.head_ref == 'codex/admin-bool-session' && '6e8bed08f02b1509c3414777d2a58523cf18cdb0' || github.head_ref == 'codex/admin-boolean-only' && 'd6b4b6c913769cccfb5e9d8ce0a890c35faa5817' || ((github.base_ref == 'main' || github.ref == 'refs/heads/main') && 'main' || 'develop') }}");
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
