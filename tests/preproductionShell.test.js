// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createApplicationShell } from "../src/app/applicationShell.js";
import { disposeComponent } from "../src/components/index.js";

describe("private environment identity", () => {
  it.each([true, false])("renders the persistent notice only for a private build: %s", preproduction => {
    const shell = createApplicationShell({ preproduction });
    try {
      const notice = shell.element.querySelector("header + .app-environment-notice");
      expect(notice?.textContent ?? null).toBe(preproduction ? "Préproduction — données de test" : null);
      expect(shell.element.querySelectorAll("main")).toHaveLength(1);
    } finally { disposeComponent(shell.element); }
  });
});
