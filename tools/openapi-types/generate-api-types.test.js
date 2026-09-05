import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  DefaultOpenApiUrl,
  generateApiTypes,
  loadOpenApiDocument,
  renderApiTypes,
  resolveOpenApiUrl,
} from "./generate-api-types.js";

/** @type {string[]} */
const temporaryDirectories = [];

/** @type {import("openapi-typescript").OpenAPI3} */
const minimalDocument = {
  openapi: "3.1.1",
  info: {
    title: "Test API",
    version: "v1",
  },
  paths: {
    "/things": {
      get: {
        operationId: "getThings",
        responses: {
          200: {
            description: "Success",
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Thing: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
        },
      },
    },
  },
};

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ),
  );
});

describe("resolveOpenApiUrl", () => {
  it("uses the local API endpoint by default", () => {
    expect(resolveOpenApiUrl(undefined).href).toBe(DefaultOpenApiUrl);
  });

  it("uses the explicit tooling override", () => {
    expect(resolveOpenApiUrl("https://api.example/openapi.json").href)
      .toBe("https://api.example/openapi.json");
  });

  it.each([
    "not-a-url",
    "file:///tmp/openapi.json",
    "https://user:password@api.example/openapi.json",
  ])("rejects an unsafe source: %s", (source) => {
    expect(() => resolveOpenApiUrl(source)).toThrow();
  });
});

describe("renderApiTypes", () => {
  it("generates stable immutable declarations from OpenAPI 3.1", async () => {
    const first = await renderApiTypes(minimalDocument);
    const second = await renderApiTypes(minimalDocument);

    expect(first).toBe(second);
    expect(first).toContain("Do not edit it manually");
    expect(first).toContain("readonly name: string");
    expect(first).toContain('readonly "/things"');
  });
});

describe("loadOpenApiDocument", () => {
  it("aborts a download after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchImplementation = createPendingFetch();
    const loading = loadOpenApiDocument(
      new URL(DefaultOpenApiUrl),
      {
        fetchImplementation,
        timeoutMs: 100,
      },
    );
    const expectation = expect(loading).rejects.toThrow(
      "timed out after 100 ms",
    );

    await vi.advanceTimersByTimeAsync(100);

    await expectation;
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});

describe("OpenAPI type generation", () => {
  it("writes a generated file and verifies it without changing it", async () => {
    const outputPath = await createOutputPath();
    const fetchImplementation = createJsonFetch(minimalDocument);

    await expect(generateApiTypes({
      fetchImplementation,
      outputPath,
    })).resolves.toBe("written");
    const generated = await readFile(outputPath, "utf8");

    await expect(generateApiTypes({
      check: true,
      fetchImplementation,
      outputPath,
    })).resolves.toBe("checked");
    await expect(readFile(outputPath, "utf8")).resolves.toBe(generated);
  });

  it("reports a missing generated file in check mode", async () => {
    const outputPath = await createOutputPath();

    await expect(generateApiTypes({
      check: true,
      fetchImplementation: createJsonFetch(minimalDocument),
      outputPath,
    })).rejects.toThrow("types are missing");
  });

  it("reports an obsolete generated file in check mode", async () => {
    const outputPath = await createOutputPath();
    await writeFile(outputPath, "obsolete", "utf8");

    await expect(generateApiTypes({
      check: true,
      fetchImplementation: createJsonFetch(minimalDocument),
      outputPath,
    })).rejects.toThrow("types are out of date");
  });

  it("keeps the versioned file when the download fails", async () => {
    const outputPath = await createOutputPath();
    const fetchImplementation = createResponseFetch("failure", 503);
    await writeFile(outputPath, "existing types", "utf8");

    await expect(generateApiTypes({
      fetchImplementation,
      outputPath,
    })).rejects.toThrow("HTTP 503");
    await expect(readFile(outputPath, "utf8")).resolves.toBe("existing types");
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("keeps the versioned file when the document is invalid", async () => {
    const outputPath = await createOutputPath();
    await writeFile(outputPath, "existing types", "utf8");

    await expect(generateApiTypes({
      fetchImplementation: createJsonFetch({ openapi: "3.1.1" }),
      outputPath,
    })).rejects.toThrow("invalid document");
    await expect(readFile(outputPath, "utf8")).resolves.toBe("existing types");
  });
});

/**
 * @returns {Promise<string>} Unique output path.
 */
async function createOutputPath() {
  const directory = await mkdtemp(join(tmpdir(), "mon-kado-api-types-"));
  temporaryDirectories.push(directory);

  return join(directory, "openapi.d.ts");
}

/**
 * @param {unknown} document JSON response body.
 * @returns {ReturnType<typeof vi.fn<typeof fetch>>} Mock fetch function.
 */
function createJsonFetch(document) {
  return createResponseFetch(JSON.stringify(document), 200);
}

/**
 * @param {string} body Response body.
 * @param {number} status HTTP status.
 * @returns {ReturnType<typeof vi.fn<typeof fetch>>} Mock fetch function.
 */
function createResponseFetch(body, status) {
  return vi.fn(
    /** @type {typeof fetch} */
    (async () => new Response(body, {
      headers: { "Content-Type": "application/json" },
      status,
    })),
  );
}

/**
 * @returns {ReturnType<typeof vi.fn<typeof fetch>>} Pending mock fetch.
 */
function createPendingFetch() {
  return vi.fn(
    /** @type {typeof fetch} */
    ((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    })),
  );
}
