import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("interface charter", () => {
  it("keeps removed modification-action labels out of every application screen", () => {
    // Arrange
    const root = new URL("../src/", import.meta.url);
    const sources = readdirSync(root, { recursive: true }).filter(path => typeof path === "string" && path.endsWith(".js"));
    // Act / Assert
    for (const path of sources) {
      const source = readFileSync(new URL(String(path).replaceAll("\\", "/"), root), "utf8");
      expect(source, String(path)).not.toMatch(/Annuler les modifications|Enregistrer les modifications/);
    }
  });
  it.each(["legal-notice", "privacy-policy", "terms-of-use"])("keeps %s themed, navigable without JavaScript and publication-blocked", page => {
    // Arrange
    const html = readFileSync(new URL(`../${page}.html`, import.meta.url), "utf8");
    const css = readFileSync(new URL("../src/styles/legal.css", import.meta.url), "utf8");
    // Act / Assert
    expect(css).toContain('@import "../styles.css"');
    expect(html).toContain('class="app-footer"');
    expect(html.match(/class="action-link action-link--default"/g)).toHaveLength(3);
    expect(html).toContain('back-link" href="/" title="Retour à l’accueil"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("data-publication-draft");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("MonKado — accueil");
  });
  it("keeps navigation and command styling free of underlines", () => {
    // Arrange
    const components = readFileSync(new URL("../src/styles/components.css", import.meta.url), "utf8");
    const views = readFileSync(new URL("../src/styles/views.css", import.meta.url), "utf8");
    // Act
    const selectedMode = views.match(/\.wish-import__modes \[aria-pressed="true"\]\s*\{([^}]+)\}/)?.[1];
    // Assert
    expect(components).toMatch(/nav a\s*\{\s*text-decoration: none/);
    expect(selectedMode).toContain("text-decoration: none");
    expect(components + views).not.toMatch(/text-decoration:\s*underline/);
  });

  it("makes the charter part of future interface development instructions", () => {
    // Arrange
    const instructions = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
    const charter = readFileSync(new URL("../DESIGN_SYSTEM.md", import.meta.url), "utf8");
    // Act / Assert
    expect(instructions).toContain("DESIGN_SYSTEM.md");
    expect(charter).toContain("04-lists-overview.png");
    expect(charter).toContain("05-wishlist-management.png");
    expect(charter).toContain("souhaits");
    expect(charter).toContain("upper right");
  });
});
