import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { LegalDocuments, verifyPublication } from "./publicationPolicy.js";

/** Verify the actual built documents, printing only the reviewed public Google flag.
 * @param {(path: string) => string} read Bounded local file reader.
 * @param {(value: string) => void} print Output boundary.
 * @returns {number} Shell status; an incomplete review never authorizes publication.
 */
export function checkPublication(read, print) {
  try {
    const configuration = JSON.parse(read("publication.json"));
    const enabled = verifyPublication(configuration, LegalDocuments.map(name => read("dist/" + name)));
    print("googleEnabled=" + String(enabled));
    return 0;
  } catch {
    print("PUBLICATION_REVIEW_REQUIRED");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = checkPublication(path => readFileSync(path, "utf8"), value => process.stdout.write(value + "\n"));
}
