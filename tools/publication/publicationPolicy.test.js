import { describe, expect, it, vi } from "vitest";
import { LegalDocuments, verifyPublication } from "./publicationPolicy.js";
import { checkPublication } from "./checkPublication.js";

const approved = { schemaVersion: 1, apiOrigin: "https://api.monkado.fr", googleEnabled: false,
  legalApproved: true, legalVersion: "2026-09-25" };
const document = '<html lang="fr"><h1>Approved fixture</h1><a href="mailto:monkado.app@gmail.com">Contact</a><p>2026-09-25</p></html>';
const documents = LegalDocuments.map(() => document);

describe("reviewed frontend publication", () => {
  it.each([false, true])("binds the approved Google setting %s to the revision", googleEnabled => {
    expect(verifyPublication({ ...approved, googleEnabled }, documents)).toBe(googleEnabled);
  });

  it.each([null, [], 1, {}, { ...approved, extra: "private-canary" }, { ...approved, schemaVersion: 2 },
    { ...approved, apiOrigin: "https://other.invalid" }, { ...approved, googleEnabled: 1 },
    { ...approved, legalApproved: false }, { ...approved, legalVersion: null },
    { ...approved, legalVersion: "yesterday" }, { ...approved, legalVersion: "2026-13-25" },
    { ...approved, legalVersion: "2026-02-30" }])("rejects incomplete or changed approval %j", value => {
    expect(() => verifyPublication(value, documents)).toThrow("PUBLICATION_REVIEW_REQUIRED");
  });

  it.each([[], [document], [""], documents.map(value => value.replace('<html lang="fr">', "<html>")),
    documents.map(value => value.replace("<h1>", "<h2>")), documents.map(value => value.replace("mailto:", "")),
    documents.map(value => value.replace("2026-09-25", "2026-09-24")),
    ...["brouillon", "À compléter", "LEGAL-01", "data-publication-draft"].map(value => documents.map(html => html + value))].map(value => ({ value })))(
    "rejects missing documents and unapproved content", ({ value }) => {
      expect(() => verifyPublication(approved, value)).toThrow("PUBLICATION_REVIEW_REQUIRED");
    });

  it("checks only exact files and prints only the public setting", () => {
    const read = vi.fn(path => path === "publication.json" ? JSON.stringify(approved) : document);
    const print = vi.fn();
    expect(checkPublication(read, print)).toBe(0);
    expect(read.mock.calls.map(call => call[0])).toEqual(["publication.json", ...LegalDocuments.map(name => "dist/" + name)]);
    expect(print).toHaveBeenCalledExactlyOnceWith("googleEnabled=false");
  });

  it("does not reveal file, parser or document errors", () => {
    const print = vi.fn();
    expect(checkPublication(() => { throw new Error("private-canary"); }, print)).toBe(1);
    expect(print).toHaveBeenCalledExactlyOnceWith("PUBLICATION_REVIEW_REQUIRED");
  });
});
