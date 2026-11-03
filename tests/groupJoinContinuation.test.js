import { describe, expect, it } from "vitest";
import { createGroupJoinContinuation } from "../src/features/groups/groupJoinContinuation.js";

const path = "/groups/join/019c52dd-56c1-7cc6-8a95-243f3a032e04";
const code = "ABCDEFGH234567AB";
function fixture() {
  /** @type {Map<string,string>} */ const values = new Map();
  /** @type {Pick<Storage,"getItem"|"setItem"|"removeItem">} */
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
  let time = 1000;
  return { storage, values, now: () => time, advance: (/** @type {number} */ value) => { time += value; } };
}

describe("group invitation authentication continuity", () => {
  it("restores a single return after reload and retains the code only for the same invitation", () => {
    const f = fixture();
    createGroupJoinContinuation(f).prepare(path, code);
    const reloaded = createGroupJoinContinuation(f);
    expect(reloaded.takeDestination()).toBe(path);
    expect(createGroupJoinContinuation(f).takeDestination()).toBeNull();
    expect(reloaded.codeFor(path)).toBe(code);
    expect(reloaded.codeFor("/groups/join")).toBe("");
    reloaded.clear(); expect(f.values.size).toBe(0); expect(reloaded.codeFor(path)).toBe("");
  });
  it.each(["https://evil.test", "//evil.test", "/groups/join/not-an-id", path+"?code=secret", path+"#secret", "/login"])("rejects an untrusted destination %s", target => {
    const c = createGroupJoinContinuation(); c.prepare(target, code);
    expect(c.takeDestination()).toBeNull(); expect(c.codeFor(target)).toBe("");
  });
  it("expires continuity instead of redirecting a later sign-in", () => {
    const f = fixture(), c = createGroupJoinContinuation(f); c.prepare(path, code);
    f.advance(30*60_000); expect(c.takeDestination()).toBeNull(); expect(f.values.size).toBe(0);
  });
  it("rejects invalid stored values, codes and clock changes", () => {
    const f = fixture();
    for (const value of ["{", "x".repeat(300), JSON.stringify({path,code:"secret",pending:true,expiresAt:5000})]) {
      f.values.set("monkado.group-join.v1",value); expect(createGroupJoinContinuation(f).takeDestination()).toBeNull();
    }
    const c = createGroupJoinContinuation(f); c.prepare(path,"invalid"); expect(c.takeDestination()).toBeNull();
    c.prepare(path,code); f.advance(-1); expect(c.takeDestination()).toBeNull();
  });
  it("keeps a code-less invitation and supports restricted storage in memory", () => {
    const storage = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); }, removeItem: () => { throw new Error(); } };
    const c = createGroupJoinContinuation({storage}); c.prepare(path,"");
    expect(c.takeDestination()).toBe(path); expect(c.takeDestination()).toBeNull(); c.clear();
  });
});
