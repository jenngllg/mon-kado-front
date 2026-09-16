import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync(new URL("../deployments/caddy/Caddyfile", import.meta.url), "utf8");

describe("deployed frontend policy", () => {
  it("restricts scripts, embedding and resource destinations without CSP reporting of private URLs", () => {
    for (const directive of ["default-src 'none'", "script-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'"])
      expect(config).toContain(directive);
    expect(config).not.toMatch(/unsafe-eval|report-uri|report-to|includeSubDomains|preload/);
    expect(config).toContain("Referrer-Policy no-referrer");
    expect(config).toContain("X-Content-Type-Options nosniff");
    expect(config).toContain('X-Robots-Tag "noindex, nofollow, noarchive"');
  });

  it("limits immutable caching to existing fingerprinted assets and excludes private source paths from the SPA", () => {
    expect(config).toContain("file {path}");
    expect(config).toContain("path_regexp fingerprint ^/assets/");
    expect(config).toContain('header Cache-Control "public, max-age=31536000, immutable"');
    expect(config.match(/header Cache-Control no-store/g)).toHaveLength(2);
    expect(config).toContain("/src/* /tools/* /node_modules/* /api/* /security/* /assets/* *.map");
    expect(config).toContain("try_files {path} /index.html");
    expect(config).toContain("@unsupported not method GET HEAD");
  });
});
