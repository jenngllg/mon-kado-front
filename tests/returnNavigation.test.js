// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBackLink } from "../src/components/backLink.js";
import { contextualReturn, initializeReturnNavigation, isLegalDocument, returnNavigationState, synchronizeReturnLink, watchReturnNavigation } from "../src/router/returnNavigation.js";

const id = "01a12c92-b24e-7e3f-836d-80ace23b792e";
const list = `/lists/${id}`;
const wish = `${list}/wishes/${id}`;
const share = `/shared-wishlists/${id}`;
const pendingKey = "monkado.return.v1";

/** @param {string} target Destination. @param {"push" | "replace"} [mode] Operation. */
function navigate(target, mode = "push") {
  window.history[mode === "push" ? "pushState" : "replaceState"](returnNavigationState(window, target, mode), "", target);
}

beforeEach(() => {
  document.body.replaceChildren(); window.sessionStorage.clear();
  window.history.replaceState({}, "", "/lists"); initializeReturnNavigation();
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); window.sessionStorage.clear(); });

describe("contextual return navigation", () => {
  it("keeps a group member between the group and their private list", () => {
    const group = `/groups/${id}`, member = `${group}/members/${id}`, groupList = `${group}/wishlists/${id}`;
    navigate(group); navigate(member); navigate(`${groupList}?fromMember=${id}`);
    expect(contextualReturn()).toEqual({ href: member, label: "Retour aux listes du membre" });
  });
  it("retains private group ancestors and safe sort preferences without secrets", () => {
    const group = `/groups/${id}`, groupList = `${group}/wishlists/${id}`;
    navigate("/groups"); navigate(group); navigate(`${groupList}?sort=priceAsc#never-store`);
    navigate(`${groupList}/wishes/${id}`);
    expect(contextualReturn()).toEqual({ href: `${groupList}?sort=priceAsc`, label: "Retour à la liste" });
    expect(JSON.stringify(window.history.state)).not.toContain("never-store");
  });
  it("returns from list editing to the overview or detail that opened it", () => {
    navigate(`${list}/edit`);
    expect(contextualReturn()).toEqual({ href: "/lists", label: "Retour à Mes listes" });
    navigate("/lists", "replace"); navigate(list); navigate(`${list}/edit`);
    expect(contextualReturn()?.href).toBe(list);
  });

  it("consumes ancestors so editor detail list returns cannot loop", () => {
    navigate(list); navigate(wish); navigate(`${wish}/edit`);
    expect(contextualReturn()?.href).toBe(wish);
    navigate(wish, "replace"); expect(contextualReturn()?.href).toBe(list);
    navigate(list, "replace"); expect(contextualReturn()?.href).toBe("/lists");
    navigate("/lists", "replace"); expect(contextualReturn()).toBeNull();
  });

  it.each(["/reservations", "/members", "/followed-lists", "/lists?isArchived=true"])("retains the origin %s after refresh", origin => {
    navigate(origin); navigate(wish); initializeReturnNavigation();
    expect(contextualReturn()?.href).toBe(origin);
  });

  it("preserves validated sort but removes secrets and arbitrary queries", () => {
    navigate(`${share}?sort=nameDesc&secret=private#bearer-secret`); navigate(`${share}/wishes/${id}`);
    expect(contextualReturn()?.href).toBe(`${share}?sort=nameDesc`);
    expect(JSON.stringify(window.history.state)).not.toMatch(/secret|private|bearer/);
  });

  it("does not return to submitted drafts after successful save navigation", () => {
    navigate(list); navigate(`${list}/wishes/new`); navigate(list);
    expect(contextualReturn()?.href).toBe("/lists");
    window.history.replaceState({}, "", `${list}/wishes/new`); initializeReturnNavigation(); navigate(list);
    expect(contextualReturn()).toBeNull();
    navigate(wish); navigate(`${wish}/edit`); navigate(wish);
    expect(contextualReturn()?.href).toBe(list);
  });

  it("bounds long navigation chains and ignores external and authentication pages", () => {
    for (let index = 1; index <= 50; index++) navigate(`/reservations?page=${index}`);
    expect(window.history.state.monkadoReturn.trail).toHaveLength(24);
    expect(returnNavigationState(window, "https://example.com/lists", "push").monkadoReturn).toBeNull();
    navigate("/login?returnTo=private"); navigate(list);
    expect(contextualReturn()).toBeNull();
  });

  it("rejects forged history metadata and keeps direct-entry fallbacks", () => {
    window.history.replaceState({ monkadoReturn: { page: "/lists", trail: ["https://example.com/"] } }, "", "/lists");
    initializeReturnNavigation(); expect(contextualReturn()).toBeNull();
    const back = createBackLink({ label: "Retour à la liste", href: list });
    expect(back.getAttribute("href")).toBe(list);
  });

  it("does not overwrite disabled, fixed or modal recovery links", () => {
    navigate(wish);
    const fixed = createBackLink({ label: "Recovery", href: list, contextual: false });
    synchronizeReturnLink(fixed); expect(fixed.getAttribute("href")).toBe(list);
    const disabled = document.createElement("a"); disabled.href = "/"; disabled.setAttribute("aria-disabled", "true");
    synchronizeReturnLink(disabled); expect(disabled.getAttribute("href")).toBe("/");
    const dialog = document.createElement("dialog"); const recovery = document.createElement("a"); recovery.href = "/"; dialog.append(recovery);
    synchronizeReturnLink(recovery); expect(recovery.getAttribute("href")).toBe("/");
  });

  it("synchronizes asynchronous arrows and stops observing after cleanup", async () => {
    navigate(wish); const stop = watchReturnNavigation(window, document.body);
    const link = document.createElement("a"); link.className = "back-link"; link.href = "/"; document.body.append(link);
    await new Promise(resolve => queueMicrotask(() => resolve(undefined)));
    expect(link.getAttribute("href")).toBe("/lists");
    stop(); link.href = "/";
    await new Promise(resolve => queueMicrotask(() => resolve(undefined))); expect(link.getAttribute("href")).toBe("/");
  });

  it("hands off legal origins once without bearer data and restores the ancestor", () => {
    navigate(`${share}#private`); const stop = watchReturnNavigation(window, document.body);
    const legal = document.createElement("a"); legal.href = "/legal-notice"; document.body.append(legal);
    legal.addEventListener("click", event => event.preventDefault()); legal.click(); stop();
    const pending = window.sessionStorage.getItem(pendingKey);
    expect(pending).not.toContain("private");
    window.history.replaceState({}, "", "/legal-notice"); initializeReturnNavigation();
    expect(contextualReturn()?.href).toBe(share);
    expect(window.sessionStorage.getItem(pendingKey)).toBeNull();
    expect(isLegalDocument("/privacy-policy.html")).toBe(true);
    expect(isLegalDocument("https://example.com/legal-notice")).toBe(false);
  });

  it("rejects expired or malformed native handoffs and tolerates unavailable storage", () => {
    window.sessionStorage.setItem(pendingKey, JSON.stringify({ target: "/legal-notice", createdAt: 0, origin: { page: "/lists", trail: [] } }));
    window.history.replaceState({}, "", "/legal-notice"); initializeReturnNavigation(); expect(contextualReturn()).toBeNull();
    vi.spyOn(window.sessionStorage, "getItem").mockImplementation(() => { throw new Error("Restricted"); });
    window.history.replaceState({}, "", "/lists"); expect(() => initializeReturnNavigation()).not.toThrow();
  });
});
