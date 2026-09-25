import { describe, expect, it } from "vitest";
import { compileRoutes, matchRoute, normalizePathname } from "../src/router/pathMatcher.js";

/** @param {Record<string, unknown>} overrides */
const route = (overrides = {}) => /** @type {import("../src/router/router.js").RouteDefinition} */ ({ name: "item", path: "/items/:id", title: "Item", render: () => { throw new Error("Rendering is outside this matcher test."); }, ...overrides });

describe("route definition validation", () => {
  it.each([null, {}, [], "routes"])("rejects an invalid collection %j", (value) => {
    // @ts-expect-error Deliberately malformed runtime input.
    expect(() => compileRoutes(value)).toThrow(TypeError);
  });
  it.each([
    null, false, route({ name: " " }), route({ name: null }),
    route({ path: null }), route({ path: "/items?x=1" }), route({ path: "/items#x" }),
    route({ title: null }), route({ render: null }), route({ beforeEnter: false }),
    route({ path: "/items/*" }), route({ path: "/:1id" }), route({ path: "/:id/:id" }),
  ])("rejects invalid definitions %#", (value) => {
    // @ts-expect-error Deliberately malformed runtime input.
    expect(() => compileRoutes([value])).toThrow(TypeError);
  });
  it.each([undefined, null, "items", "//host/items"])("rejects invalid path %j", (path) => {
    // @ts-expect-error Deliberately malformed runtime input.
    expect(() => normalizePathname(path)).toThrow(TypeError);
  });
  it("rejects duplicate names independently of paths", () => {
    expect(() => compileRoutes([route(), route({ path: "/different" })])).toThrow(/Duplicate route name/);
  });
  it("rejects equivalent parameter patterns with different names", () => {
    expect(() => compileRoutes([route(), route({ name: "other", path: "/items/:other" })])).toThrow(/Duplicate route pattern/);
  });
});

describe("deterministic route matching", () => {
  it("prioritizes static routes over parameters and freezes results", () => {
    const routes = compileRoutes([route(), route({ name: "new", path: "/items/new" })]);
    expect(matchRoute(routes, "/items/new/")?.route.definition.name).toBe("new");
    const match = matchRoute(routes, "/items/caf%C3%A9");
    if (match === null) throw new Error("Expected the parameter route to match.");
    expect(match.params).toEqual({ id: "café" });
    for (const object of [routes, routes[0], routes[0].definition, routes[0].segments, match, match.params]) {
      expect(Object.isFrozen(object)).toBe(true);
    }
  });
  it("orders equal static scores by length then registration order", () => {
    const routes = compileRoutes([
      route({ name: "short", path: "/:id", title: () => "Short", beforeEnter: () => true }),
      route({ name: "long", path: "/:id/:child" }),
      route({ name: "first", path: "/first/:id" }),
      route({ name: "second", path: "/second/:id" }),
    ]);
    expect(routes.map(entry => entry.definition.name)).toEqual(["first", "second", "long", "short"]);
  });
  it.each(["/other/value", "/items", "/items/a/b", "/items/%E0%A4%A"])("does not match %s", (path) => {
    expect(matchRoute(compileRoutes([route()]), path)).toBeNull();
  });
  it("preserves the root while removing trailing slashes", () => {
    expect(normalizePathname("/")).toBe("/");
    expect(normalizePathname("/items///")).toBe("/items");
    expect(matchRoute(compileRoutes([route({ path: "/" })]), "/")?.params).toEqual({});
  });
});
