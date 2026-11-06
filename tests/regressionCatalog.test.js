import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { RoutePaths } from "../src/app/routeContracts.js";
import { regressionCatalog, renderRegressionMatrix } from "../tools/regression/catalog.js";

describe("regression coverage inventory", () => {
  it("assigns every application route exactly once, so new routes cannot silently escape review", () => {
    const assigned = regressionCatalog.flatMap(entry => entry.routes);
    expect([...assigned].sort()).toEqual(Object.keys(RoutePaths).sort());
    expect(new Set(assigned).size).toBe(assigned.length);
  });
  it("references maintained test suites and documents external checks honestly", () => {
    for (const entry of regressionCatalog) {
      expect(entry.checks.length).toBeGreaterThan(20);
      for (const [directory, suites] of [["e2e", entry.browser], ["e2e-native", entry.native]]) {
        for (const name of suites) expect(existsSync(new URL(`../${directory}/${name}.spec.js`, import.meta.url))).toBe(true);
      }
      if (entry.native.length === 0) expect(entry.limit).toBeTruthy();
    }
  });
  it("keeps the reviewable matrix synchronized with the inventory", () => {
    expect(readFileSync(new URL("../docs/regression-matrix.md", import.meta.url), "utf8")).toBe(renderRegressionMatrix());
  });
});
