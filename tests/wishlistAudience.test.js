// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishlistAudience } from "../src/features/wishlists/wishlistAudience.js";
import { disposeComponent } from "../src/components/index.js";
import { barrier } from "./sessionTestHelpers.js";
const { document } = globalThis;

const views = /** @type {HTMLElement[]} */ ([]);
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {boolean} isPublic @param {boolean[]} visible */
function response(isPublic, visible) {
  return { visibility: { wishlistId: "019c52dd-56c1-7cc6-8a95-243f3a032e04", isPublic,
    groups: visible.map((isVisible, index) => ({ groupId: String(index), name: `Groupe ${index}`, isVisible })) }, etag: '"visibility"' };
}
/** @param {Parameters<typeof createWishlistAudience>[0]['load']} load */
function setup(load) {
  const signal = new AbortController().signal;
  const audience = createWishlistAudience({ load, signal });
  document.body.append(audience.element); views.push(audience.element);
  return audience;
}

describe("wishlist audience", () => {
  it.each([
    [false, [], "Seulement moi", "Lien public inactif"],
    [false, [true, false], "Partagée avec 1 groupe", "Lien public inactif"],
    [true, [true, false], "Partagée avec 1 groupe", "Lien public actif"],
    [false, [true, true, false], "Partagée avec 2 groupes", "Lien public inactif"],
    [true, [true, true, false], "Partagée avec 2 groupes", "Lien public actif"],
    [true, [false], "Aucun groupe", "Lien public actif"],
  ])("summarizes only the effective server audience (%s, %j)", async (isPublic, groups, expected, linkState) => {
    const load = vi.fn().mockResolvedValue(response(/** @type {boolean} */ (isPublic), /** @type {boolean[]} */ (groups)));
    const audience = setup(load);
    await audience.refresh();
    expect([...audience.element.querySelectorAll('[role="status"] p')].map(item => item.textContent)).toEqual([expected, linkState]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not assert a private audience after a failed read and offers an explicit retry", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(response(false, []));
    const audience = setup(load);
    await audience.refresh();
    expect(audience.element.textContent).toContain("Visibilité à vérifier");
    expect(audience.element.textContent).not.toContain("Seulement moi");
    audience.element.querySelector("button")?.click();
    await vi.waitFor(() => expect(audience.element.querySelector('[role="status"] p')?.textContent).toBe("Seulement moi"));
    expect(audience.element.querySelector("button")?.hidden).toBe(true);
  });

  it("ignores an older response and a response arriving after disposal", async () => {
    const old = barrier();
    const disposed = barrier();
    const load = vi.fn().mockImplementationOnce(() => old.promise.then(() => response(false, []))).mockResolvedValueOnce(response(true, [true])).mockImplementationOnce(() => disposed.promise.then(() => response(false, [])));
    const audience = setup(load);
    const first = audience.refresh();
    await audience.refresh();
    old.resolve(); await first;
    expect([...audience.element.querySelectorAll('[role="status"] p')].map(item => item.textContent)).toEqual(["Partagée avec 1 groupe", "Lien public actif"]);
    const last = audience.refresh(); disposeComponent(audience.element);
    disposed.resolve(); await last;
    expect(audience.element.querySelector('[role="status"]')?.textContent).toBe("");
  });
});
