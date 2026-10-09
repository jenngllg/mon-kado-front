import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { LegalDocuments, verifyPublication, verifyTemporaryPublication } from "./publicationPolicy.js";

/** Verify the actual built documents, printing only the reviewed public Google flag.
 * @param {(path: string) => string} read Bounded local file reader.
 * @param {(value: string) => void} print Output boundary.
 * @param {boolean} temporaryTest Explicit operator exception for a temporary production test.
 * @returns {number} Shell status; ordinary publication still requires approval.
 */
export function checkPublication(read, print, temporaryTest = false) {
  try {
    const configuration = JSON.parse(read("publication.json"));
    const verify = temporaryTest ? verifyTemporaryPublication : verifyPublication;
    const enabled = verify(configuration, LegalDocuments.map(name => read("dist/" + name)));
    print("googleEnabled=" + String(enabled));
    return 0;
  } catch {
    print("PUBLICATION_REVIEW_REQUIRED");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = checkPublication(path => readFileSync(path, "utf8"), value => process.stdout.write(value + "\n"),
    process.argv[2] === "--temporary-test");
}
