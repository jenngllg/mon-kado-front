import { describe, expect, it, vi } from "vitest";
import { createSharedWishlistContext } from "../src/features/sharing/sharedWishlistContext.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", other = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const secret = "A".repeat(43), key = "monkado.shared-wishlist.v1";
function storage() {
  const values = new Map();
  return { values, getItem: vi.fn(name => values.get(name) ?? null), setItem: vi.fn((name, value) => values.set(name, value)), removeItem: vi.fn(name => values.delete(name)) };
}

describe("bounded tab sharing continuity", () => {
  it("restores only the same validated share after a new application mounts", async () => {
    const cache = storage(); const first = createSharedWishlistContext({ storage: cache, now: () => 100 });
    expect(first.enter(id, `#${secret}`)).toBe("ready");
    const next = createSharedWishlistContext({ storage: cache, now: () => 200 });
    expect(next.enter(id.toUpperCase(), "")).toBe("ready");
    const operation = vi.fn(async value => value);
    expect(await next.run(id, operation)).toBe(secret); expect(operation).toHaveBeenCalledOnce();
    expect(Object.keys(next)).not.toContain("secret");
    const signal = next.observe(id); next.clear();
    expect(signal?.aborted).toBe(true); expect(cache.values.size).toBe(0);
  });
  it.each([null, "{", "x".repeat(257), JSON.stringify({ id, secret }), JSON.stringify({ id, secret, expiresAt: 99 }),
    JSON.stringify({ id, secret, expiresAt: 2000000 }), JSON.stringify({ id: other, secret, expiresAt: 200 }),
    JSON.stringify({ id, secret: "invalid", expiresAt: 200 }), "null"])("rejects malformed, expired or unrelated continuity %#", raw => {
    const cache = storage(); cache.values.set(key, raw);
    const context = createSharedWishlistContext({ storage: cache, now: () => 100 });
    expect(context.enter(id, "")).toBe("missing"); expect(cache.values.size).toBe(0);
  });
  it("invalidates continuity on malformed replacement, different share and disposal", () => {
    const cache = storage(); const context = createSharedWishlistContext({ storage: cache });
    context.enter(id, `#${secret}`); expect(context.enter(id, "#invalid")).toBe("invalid"); expect(cache.values.size).toBe(0);
    context.enter(id, `#${secret}`); expect(context.enter(other, "")).toBe("missing"); expect(cache.values.size).toBe(0);
    context.enter(id, `#${secret}`); context.dispose(); expect(cache.values.size).toBe(0);
    expect(context.enter(id, "")).toBe("missing");
  });
  it("forgets reload continuity without revoking explicit public in-memory access", async () => {
    const cache = storage(); const context = createSharedWishlistContext({ storage: cache });
    context.enter(id, `#${secret}`); context.forgetContinuity(); expect(cache.values.size).toBe(0);
    expect(context.enter(id, "")).toBe("ready"); expect(await context.run(id, async value => value)).toBe(secret);
    expect(createSharedWishlistContext({ storage: cache }).enter(id, "")).toBe("missing");
    const denied = createSharedWishlistContext({ storage: { ...cache, removeItem: () => { throw new Error("denied"); } } });
    expect(() => denied.forgetContinuity()).not.toThrow();
  });
  it("retains memory-only access when browser storage is denied", async () => {
    const denied = { getItem: vi.fn(() => { throw new Error("restricted"); }), setItem: vi.fn(() => { throw new Error("restricted"); }), removeItem: vi.fn(() => { throw new Error("restricted"); }) };
    const context = createSharedWishlistContext({ storage: denied });
    expect(context.enter(id, "")).toBe("missing"); expect(context.enter(id, `#${secret}`)).toBe("ready");
    expect(await context.run(id, async value => value)).toBe(secret);
    context.clear(); expect(context.enter(id, "")).toBe("missing");
  });
});
