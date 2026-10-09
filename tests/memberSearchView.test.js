// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemberSearchView } from "../src/features/members/memberSearchView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
const page = { items: [{ id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", displayName: "<img src=x>", photo: { imageUrl: /** @type {string | null} */ (null), imageUnavailable: false } }], currentPage: 1, pageSize: 20, totalCount: 1 };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {AbortSignal} [signal] View lifetime. */
function setup(signal) {
  const search = vi.fn(/** @type {import("../src/features/members/memberSearchService.js").SearchMembers} */ (async () => page));
  const view = createMemberSearchView({ search, signal }); views.push(view); document.body.append(view);
  const input = /** @type {HTMLInputElement} */ (view.querySelector("input"));
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  const submit = () => form.dispatchEvent(new Event("submit", { cancelable: true }));
  const click = (/** @type {string} */ label) => [...view.querySelectorAll("button")].find(button => button.textContent === label)?.click();
  return { view, search, input, form, submit, click };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
describe("member search presentation", () => {
  it("makes no initial request, labels the search, validates and focuses invalid input", () => {
    const { view, search, input, form, submit } = setup();
    expect(search).not.toHaveBeenCalled(); expect(form.noValidate).toBe(true); expect(input.hasAttribute("maxlength")).toBe(false);
    expect(view.querySelector(".form-field__description")).toBeNull();
    expect(view.querySelector("label")?.htmlFor).toBe(input.id); submit(); expect(search).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input); expect(input.getAttribute("aria-invalid")).toBe("true");
    input.value = "Jenn"; input.dispatchEvent(new Event("input")); expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(view.querySelector('[role="alert"]')).toBeNull();
  });
  it("renders text-only names after explicit submission and focuses results", async () => {
    const { view, search, input, submit } = setup(); input.value = " Jenn "; input.dispatchEvent(new Event("input")); expect(search).not.toHaveBeenCalled();
    submit(); expect(view.textContent).toContain("Recherche de membres…"); await settle();
    expect(search).toHaveBeenCalledExactlyOnceWith("Jenn", { page: 1, signal: expect.any(AbortSignal) });
    expect(view.querySelector(".member-search-result__name")?.textContent).toBe("<img src=x>"); expect(view.querySelector("img")).toBeNull();
    expect(view.querySelector("li a")?.getAttribute("href")).toBe(`/members/${page.items[0].id}`); expect(document.activeElement).toBe(view.querySelector("h2"));
  });
  it("places each namesake's photo before its name and clears photo sources on a new search", async () => {
    const { view, search, input, submit } = setup();
    const urls = ["https://api.example.test/photo-a", "https://api.example.test/photo-b"];
    search.mockResolvedValue({ ...page, totalCount: 2, items: urls.map((imageUrl, i) => ({ ...page.items[0], id: page.items[0].id.slice(0, -1) + i, displayName: "Jenn", photo: { imageUrl, imageUnavailable: false } })) });
    input.value = "Jenn"; submit(); await settle();
    const photos = [...view.querySelectorAll(".member-avatar img")];
    expect(photos.map(photo => photo.getAttribute("src"))).toEqual(urls);
    expect([...view.querySelectorAll(".member-search-result a")].every(item => item.firstElementChild?.classList.contains("member-avatar"))).toBe(true);
    search.mockResolvedValue({ ...page, items: [], totalCount: 0 }); submit(); await settle();
    expect(photos.every(photo => !photo.hasAttribute("src"))).toBe(true);
  });
  it("keeps submitted search separate from edits across pagination then resets on submission", async () => {
    const { view, search, input, submit, click } = setup(); search.mockResolvedValue({ ...page, totalCount: 40 }); input.value = "Jenn"; submit(); await settle();
    input.value = "Alice"; click("Page suivante"); await settle(); expect(search.mock.calls.at(-1)).toEqual(["Jenn", { page: 2, signal: expect.any(AbortSignal) }]);
    expect(view.textContent).toContain("Page 2 sur 2"); click("Page précédente"); await settle(); expect(search.mock.calls.at(-1)?.[1].page).toBe(1);
    submit(); await settle(); expect(search.mock.calls.at(-1)).toEqual(["Alice", { page: 1, signal: expect.any(AbortSignal) }]);
  });
  it("clears old results, prevents double submission and handles empty results", async () => {
    const { view, search, input, submit } = setup(); input.value = "Jenn"; submit(); await settle();
    const gate = barrier(); search.mockImplementation(async () => { await gate.promise; return { ...page, items: [], totalCount: 0 }; });
    submit(); submit(); expect(search).toHaveBeenCalledTimes(2); expect(input.disabled).toBe(true); expect(view.querySelector("li")).toBeNull();
    gate.resolve(); await settle(); expect(view.textContent).toContain("Aucun membre trouvé"); expect(input.disabled).toBe(false);
  });
  it("shows a recoverable error without adding a retry button", async () => {
    const { view, search, input, submit, click } = setup(); input.value = "Jenn"; search.mockResolvedValue({ ...page, totalCount: 40 }); submit(); await settle();
    search.mockRejectedValue(new ApiError({ kind: "http", statusCode: 429, correlationId: "reference", retryAfterSeconds: 8 })); click("Page suivante"); await settle();
    expect(view.textContent).toContain("8 seconde(s)"); expect(view.textContent).toContain("reference"); expect(document.activeElement?.getAttribute("role")).toBe("alert");
    expect(view.textContent).not.toContain("Réessayer");
    input.value = "Alice"; search.mockResolvedValue({ ...page, items: [], totalCount: 0 }); submit(); await settle();
    expect(search.mock.calls.at(-1)).toEqual(["Alice", { page: 1, signal: expect.any(AbortSignal) }]); expect(view.textContent).toContain("Aucun membre trouvé");
  });
  it("offers a first-page navigation when the requested results page disappears", async () => {
    const { view, search, input, submit, click } = setup(); input.value = "Jenn"; search.mockResolvedValue({ ...page, totalCount: 40 }); submit(); await settle();
    search.mockResolvedValue({ ...page, items: [], totalCount: 0 }); click("Page suivante"); await settle();
    expect(view.textContent).toContain("Cette page n’est plus disponible");
    click("Revenir à la première page"); await settle(); expect(search.mock.calls.at(-1)?.[1].page).toBe(1);
  });
  it("restores the submitted query and page after visiting a profile without storing results", async () => {
    const state = { query: "Jenn", page: 2 };
    const search = vi.fn(async () => ({ ...page, totalCount: 40 }));
    const view = createMemberSearchView({ search, state }); views.push(view); document.body.append(view); await settle();
    expect(search).toHaveBeenCalledExactlyOnceWith("Jenn", { page: 2, signal: expect.any(AbortSignal) });
    expect(view.querySelector("input")?.value).toBe("Jenn"); disposeComponent(view);
    expect(state).toEqual({ query: "Jenn", page: 2 });
  });
  it("defers blur validation while the submit target is being pressed", () => {
    const { view, input, submit } = setup(); const button = /** @type {HTMLButtonElement} */ (view.querySelector('button[type="submit"]'));
    input.value = "a"; input.dispatchEvent(new Event("input")); button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("blur", { relatedTarget: button })); expect(input.hasAttribute("aria-invalid")).toBe(false);
    button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); submit(); expect(input.getAttribute("aria-invalid")).toBe("true");
  });
  it.each([false, true])("cleans idempotently and ignores late completion, rejection=%s", async reject => {
    const controller = new AbortController(); const { view, search, input, submit } = setup(controller.signal); const gate = barrier();
    search.mockImplementation(async () => { await gate.promise; if (reject) throw new ApiError({ kind: "network" }); return page; });
    input.value = "Jenn"; submit(); const signal = search.mock.calls[0][1].signal; controller.abort(); disposeComponent(view); gate.resolve(); await settle();
    expect(signal.aborted).toBe(true); expect(input.value).toBe(""); expect(view.querySelector("li, [role=alert]")).toBeNull();
  });
  it("does not start with an already aborted lifetime", () => {
    const controller = new AbortController(); controller.abort(); const { input, submit, search } = setup(controller.signal); input.value = "Jenn"; submit(); expect(search).not.toHaveBeenCalled();
  });
});
