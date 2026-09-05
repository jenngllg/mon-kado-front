import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, {
  COMMENT_HEADER,
  astToString,
} from "openapi-typescript";

export const DefaultOpenApiUrl = "http://localhost:7000/openapi/v1.json";
export const DefaultTimeoutMilliseconds = 30_000;

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const DefaultOutputPath = resolve(
  moduleDirectory,
  "../../src/api/generated/openapi.d.ts",
);
const GeneratedFileHeader = `/**
 * This file was generated from the MonKado OpenAPI contract.
 * Do not edit it manually. Run \`pnpm api:types\` instead.
 */

`;

/**
 * Resolves and validates the OpenAPI endpoint used by the generator.
 *
 * @param {string | undefined} overrideUrl Optional tooling override.
 * @returns {URL} Validated HTTP endpoint.
 */
export function resolveOpenApiUrl(overrideUrl) {
  const source = overrideUrl?.trim() || DefaultOpenApiUrl;
  let url;

  try {
    url = new URL(source);
  } catch {
    throw new Error(
      "MONKADO_OPENAPI_URL must be an absolute HTTP or HTTPS URL.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      "MONKADO_OPENAPI_URL must use the HTTP or HTTPS protocol.",
    );
  }

  if (url.username || url.password) {
    throw new Error(
      "MONKADO_OPENAPI_URL must not contain embedded credentials.",
    );
  }

  return url;
}

/**
 * Downloads one OpenAPI document without retrying the request.
 *
 * @param {URL} url Validated OpenAPI endpoint.
 * @param {{
 *   fetchImplementation?: typeof fetch,
 *   timeoutMs?: number
 * }} [options] Download dependencies.
 * @returns {Promise<import("openapi-typescript").OpenAPI3>} Parsed contract.
 */
export async function loadOpenApiDocument(
  url,
  {
    fetchImplementation = globalThis.fetch,
    timeoutMs = DefaultTimeoutMilliseconds,
  } = {},
) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    timeoutMs,
  );

  try {
    const response = await fetchImplementation(url, {
      headers: { Accept: "application/json" },
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      throw new Error(
        `The OpenAPI endpoint returned HTTP ${response.status}.`,
      );
    }

    const document = /** @type {unknown} */ (await response.json());

    if (!isOpenApiDocument(document)) {
      throw new Error("The OpenAPI endpoint returned an invalid document.");
    }

    return document;
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw new Error(
        `The OpenAPI request timed out after ${timeoutMs} ms.`,
        { cause: error },
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "The OpenAPI document could not be downloaded.",
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Produces stable TypeScript declarations from an OpenAPI document.
 *
 * @param {import("openapi-typescript").OpenAPI3} document OpenAPI contract.
 * @returns {Promise<string>} Complete generated file.
 */
export async function renderApiTypes(document) {
  const ast = await openapiTS(document, {
    alphabetize: true,
    immutable: true,
  });
  const generated = astToString(ast)
    .replace(COMMENT_HEADER, "")
    .replaceAll("\r\n", "\n")
    .trimEnd();

  return `${GeneratedFileHeader}${generated}\n`;
}

/**
 * Generates or verifies the versioned OpenAPI declaration file.
 *
 * @param {{
 *   check?: boolean,
 *   fetchImplementation?: typeof fetch,
 *   openApiUrl?: string,
 *   outputPath?: string,
 *   timeoutMs?: number
 * }} [options] Generation options.
 * @returns {Promise<"checked" | "written">} Completed operation.
 */
export async function generateApiTypes({
  check = false,
  fetchImplementation = globalThis.fetch,
  openApiUrl,
  outputPath = DefaultOutputPath,
  timeoutMs = DefaultTimeoutMilliseconds,
} = {}) {
  const url = resolveOpenApiUrl(openApiUrl);
  const document = await loadOpenApiDocument(
    url,
    {
      fetchImplementation,
      timeoutMs,
    },
  );
  const generated = await renderApiTypes(document);

  if (check) {
    const current = await readVersionedTypes(outputPath);

    if (current !== generated) {
      throw new Error(
        "The generated API types are out of date. Run `pnpm api:types`.",
      );
    }

    return "checked";
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated, "utf8");

  return "written";
}

/**
 * Runs the command-line entry point.
 *
 * @param {string[]} argumentsList Command-line arguments.
 * @param {NodeJS.ProcessEnv} environment Process environment.
 * @returns {Promise<void>} Completion signal.
 */
export async function runCli(
  argumentsList = process.argv.slice(2),
  environment = process.env,
) {
  const unknownArguments = argumentsList.filter(
    (argument) => argument !== "--check",
  );

  if (unknownArguments.length > 0) {
    throw new Error("Only the optional `--check` argument is supported.");
  }

  const check = argumentsList.includes("--check");
  const result = await generateApiTypes({
    check,
    openApiUrl: environment.MONKADO_OPENAPI_URL,
  });
  const action = result === "checked" ? "are up to date" : "were generated";
  console.log(`OpenAPI types ${action}.`);
}

/**
 * @param {string} outputPath Generated declaration path.
 * @returns {Promise<string>} Existing declaration content.
 */
async function readVersionedTypes(outputPath) {
  try {
    return await readFile(outputPath, "utf8");
  } catch (error) {
    if (isFileNotFoundError(error)) {
      throw new Error(
        "The generated API types are missing. Run `pnpm api:types`.",
        { cause: error },
      );
    }

    throw error;
  }
}

/**
 * @param {unknown} value Potential OpenAPI document.
 * @returns {value is import("openapi-typescript").OpenAPI3} Validation result.
 */
function isOpenApiDocument(value) {
  return isRecord(value) &&
    typeof value.openapi === "string" &&
    isRecord(value.info) &&
    typeof value.info.title === "string" &&
    typeof value.info.version === "string";
}

/**
 * @param {unknown} value Potential object.
 * @returns {value is Record<string, unknown>} Whether the value is an object.
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} error Potential file-system error.
 * @returns {error is NodeJS.ErrnoException} Whether the file is absent.
 */
function isFileNotFoundError(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

const isMainModule = process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  runCli().catch((error) => {
    const message = error instanceof Error
      ? error.message
      : "The OpenAPI types could not be generated.";
    console.error(`OpenAPI type generation failed: ${message}`);
    process.exitCode = 1;
  });
}
