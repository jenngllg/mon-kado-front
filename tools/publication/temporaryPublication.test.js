import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { checkPublication } from "./checkPublication.js";
import { LegalDocuments, verifyTemporaryPublication } from "./publicationPolicy.js";

const configuration = { schemaVersion: 1, apiOrigin: "https://api.monkado.fr", googleEnabled: false,
  legalApproved: false, legalVersion: null };
const document = '<html lang="fr"><h1>Brouillon</h1><a href="mailto:monkado.app@gmail.com">Contact</a></html>';
const documents = LegalDocuments.map(() => document);

describe("explicit temporary publication", () => {
  it("preserves unapproved documents and configuration without enabling Google", () => {
    expect(verifyTemporaryPublication(configuration, documents)).toBe(false);
    expect(configuration.legalApproved).toBe(false);
    expect(configuration.legalVersion).toBeNull();
    expect(documents).toEqual(LegalDocuments.map(() => document));
  });

  it("preserves an explicitly enabled revision setting without claiming legal approval", () => {
    const enabled = { ...configuration, googleEnabled: true };
    expect(verifyTemporaryPublication(enabled, documents)).toBe(true);
    expect(enabled.legalApproved).toBe(false);
    expect(enabled.legalVersion).toBeNull();
    expect(verifyTemporaryPublication(configuration, documents)).toBe(false);
  });

  it.each([null, [], 1, {}, { ...configuration, extra: true }, { ...configuration, schemaVersion: 2 },
    { ...configuration, apiOrigin: "https://other.invalid" }, { ...configuration, googleEnabled: "true" },
    { ...configuration, googleEnabled: null }, { ...configuration, googleEnabled: 1 },
    { ...configuration, legalApproved: true }, { ...configuration, legalVersion: "2026-10-06" }])(
    "rejects unrelated configuration changes %j", value => {
      expect(() => verifyTemporaryPublication(value, documents)).toThrow("PUBLICATION_REVIEW_REQUIRED");
    });

  it.each([[], documents.map(() => ""), documents.map(value => value.replace('<html lang="fr"', "<html")),
    documents.map(value => value.replace("<h1>", "<h2>")), documents.map(value => value.replace("mailto:", ""))]
    .map(value => ({ value })))("still requires complete built documents", ({ value }) => {
    expect(() => verifyTemporaryPublication(configuration, value)).toThrow("PUBLICATION_REVIEW_REQUIRED");
  });

  it.each([false, true])("requires an explicit exception %s", temporaryTest => {
    const read = vi.fn(path => path === "publication.json" ? JSON.stringify(configuration) : document);
    const print = vi.fn();
    expect(checkPublication(read, print, temporaryTest)).toBe(temporaryTest ? 0 : 1);
    expect(print).toHaveBeenCalledExactlyOnceWith(temporaryTest ? "googleEnabled=false" : "PUBLICATION_REVIEW_REQUIRED");
  });

  it.each([false, true])("keeps Google-enabled drafts behind the explicit exception %s", temporaryTest => {
    const read = vi.fn(path => path === "publication.json" ? JSON.stringify({ ...configuration, googleEnabled: true }) : document);
    const print = vi.fn();
    expect(checkPublication(read, print, temporaryTest)).toBe(temporaryTest ? 0 : 1);
    expect(print).toHaveBeenCalledExactlyOnceWith(temporaryTest ? "googleEnabled=true" : "PUBLICATION_REVIEW_REQUIRED");
  });

  it("keeps the exception opt-in and all technical publication gates", () => {
    const workflow = readFileSync(new URL("../../.github/workflows/publish-frontend.yml", import.meta.url), "utf8");
    expect(workflow).toContain("temporary_test:");
    expect(workflow).toContain("default: false");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("required_reviewers");
    expect(workflow).toContain("pnpm api:types:check");
    expect(workflow).toContain("node tools/publication/checkPublication.js --temporary-test");
    expect(workflow).toContain('node tools/publication/checkPublication.js >> "$GITHUB_OUTPUT"');
    expect(workflow).not.toContain("continue-on-error");
  });
});
