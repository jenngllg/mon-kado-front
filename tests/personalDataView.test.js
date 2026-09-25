// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPersonalDataView } from "../src/features/privacy/personalDataView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

/** @type {import("../src/features/privacy/personalDataService.js").PersonalExport} */
const ready = { id: "01990000-0000-7000-8000-000000000001", status: "ready", createdAt: "2026-09-25T10:00:00Z",
  snapshotAt: "2026-09-25T10:00:00Z", readyAt: "2026-09-25T10:00:00Z", expiresAt: "2026-09-26T10:00:00Z", sizeInBytes: 3, errorCode: null };
afterEach(() => {
  for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view);
  document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
/** @param {import("../src/features/privacy/personalDataService.js").PersonalExport | null} [initial] */
function fixture(initial = null) {
  const service = {
    latest: vi.fn(async () => initial), requestExport: vi.fn(async () => ({ ...ready, status: /** @type {const} */ ("queued"), expiresAt: null })),
    refresh: vi.fn(async () => ready), download: vi.fn(async () => ({ blob: new Blob(["zip"], { type: "application/zip" }), filename: "fixture.zip" })),
    requestDeletion: vi.fn(async () => {}),
  };
  const controller = new AbortController();
  return { service, controller, mount: () => {
    const view = createPersonalDataView({ service, signal: controller.signal }); document.body.append(view); return view;
  } };
}
/** @param {HTMLElement} root @param {string} label @returns {HTMLButtonElement} */
function button(root, label) {
  const item = [...root.querySelectorAll("button")].find(candidate => candidate.textContent === label);
  if (!item) throw new Error("Missing button " + label);
  return item;
}
/** @param {HTMLElement} view */
async function idle(view) { await vi.waitFor(() => expect(button(view, "Demander mon export").disabled).toBe(false)); }

describe("personal data lifecycle UI", () => {
  it("reads the latest state once, requests only on click and explicitly refreshes the selected export", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); await idle(view);
    // Assert
    expect(view.textContent).toContain("Aucune demande d’export"); expect(f.service.latest).toHaveBeenCalledOnce();
    expect(f.service.requestExport).not.toHaveBeenCalled();
    // Act
    button(view, "Actualiser l’état").click(); await idle(view);
    expect(f.service.latest).toHaveBeenCalledTimes(2);
    button(view, "Demander mon export").click(); await idle(view);
    expect(view.textContent).toContain("En attente de préparation");
    button(view, "Actualiser l’état").click(); await idle(view);
    // Assert
    expect(view.textContent).toContain("Archive disponible"); expect(view.textContent).toContain("Fin de disponibilité");
    expect(f.service.refresh).toHaveBeenCalledExactlyOnceWith(ready.id, { signal: expect.any(AbortSignal) });
    expect(button(view, "Télécharger mon archive").hidden).toBe(false);
  });
  it.each(["processing", "failed", "expired"])("represents %s without downloading or creating another export", async status => {
    // Arrange
    const f = fixture({ ...ready, status: /** @type {typeof ready.status} */ (status) });
    // Act
    const view = f.mount(); await idle(view);
    // Assert
    expect(button(view, "Télécharger mon archive").hidden).toBe(true); expect(f.service.download).not.toHaveBeenCalled();
    expect(f.service.requestExport).not.toHaveBeenCalled();
  });
  it("downloads only a received Blob and revokes local URLs on replacement and disposal", async () => {
    // Arrange
    const f = fixture(ready); const view = f.mount(); await idle(view);
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clicks = /** @type {{href: string, download: string}[]} */ ([]);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(/** @this {HTMLAnchorElement} */ function () {
      clicks.push({ href: this.getAttribute("href") ?? "", download: this.download });
    });
    // Act
    button(view, "Télécharger mon archive").click(); await idle(view);
    button(view, "Télécharger mon archive").click(); await idle(view);
    // Assert
    expect(create).toHaveBeenCalledTimes(2); expect(clicks).toEqual([{ href: "blob:first", download: "fixture.zip" }, { href: "blob:second", download: "fixture.zip" }]);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:first"); expect(view.querySelector("a[download]")).toBeNull();
    // Act
    f.controller.abort();
    // Assert
    expect(revoke).toHaveBeenLastCalledWith("blob:second"); expect(f.service.download).toHaveBeenCalledWith(ready, { signal: expect.any(AbortSignal) });
  });
  it("ignores a synthetic activation of a hidden download with no archive", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); await idle(view);
    // Act
    button(view, "Télécharger mon archive").dispatchEvent(new MouseEvent("click")); await idle(view);
    // Assert
    expect(f.service.download).not.toHaveBeenCalled();
  });
  it("does not repeat a request or expose raw errors when the operation fails", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); await idle(view);
    f.service.requestExport.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 12 }));
    // Act
    button(view, "Demander mon export").click(); await idle(view);
    // Assert
    expect(f.service.requestExport).toHaveBeenCalledOnce(); expect(view.textContent).toContain("12 seconde(s)");
    // Act
    f.service.requestExport.mockRejectedValueOnce(new Error("private-canary"));
    button(view, "Demander mon export").click(); await idle(view);
    // Assert
    expect(view.textContent).not.toContain("private-canary"); expect(view.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });
  it("makes deletion a separate explicit email request, not the destructive confirmation", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); await idle(view);
    // Act
    button(view, "Recevoir le lien de suppression").click(); await idle(view);
    // Assert
    expect(f.service.requestDeletion).toHaveBeenCalledExactlyOnceWith({ signal: expect.any(AbortSignal) });
    expect(view.textContent).toContain("Consulte tes e-mails"); expect(f.service.requestExport).not.toHaveBeenCalled();
  });
  it("disables competing operations while waiting and ignores cancellation errors", async () => {
    // Arrange
    const f = fixture(); const release = barrier();
    f.service.latest.mockImplementation(async () => { await release.promise; throw createAbortError(); });
    const view = f.mount();
    // Act
    const request = button(view, "Demander mon export"); request.disabled = false;
    request.dispatchEvent(new MouseEvent("click")); request.disabled = true;
    // Assert
    expect(f.service.requestExport).not.toHaveBeenCalled(); expect([...view.querySelectorAll("button")].every(item => item.disabled)).toBe(true);
    release.resolve(); await idle(view);
    expect(view.querySelector('[role="alert"]')).toBeNull();
  });
  it.each(["read", "request", "download", "deletion", "failure"])("does not revive disposed data after late %s", async operation => {
    // Arrange
    const f = fixture(ready); const release = barrier(); const create = vi.spyOn(URL, "createObjectURL");
    if (operation === "read") f.service.latest.mockImplementation(async () => { await release.promise; return ready; });
    const view = f.mount();
    if (operation !== "read") {
      await idle(view);
      if (operation === "request" || operation === "failure") {
        f.service.requestExport.mockImplementation(async () => { await release.promise; if (operation === "failure") throw new Error("private"); return { ...ready, status: "queued", expiresAt: null }; });
        button(view, "Demander mon export").click();
      } else if (operation === "download") {
        f.service.download.mockImplementation(async () => { await release.promise; return { blob: new Blob(["zip"]), filename: "private.zip" }; });
        button(view, "Télécharger mon archive").click();
      } else {
        f.service.requestDeletion.mockImplementation(async () => { await release.promise; });
        button(view, "Recevoir le lien de suppression").click();
      }
    }
    // Act
    f.controller.abort(); release.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    // Assert
    expect(view.querySelector('[role="status"]')?.textContent).toBe(""); expect(view.textContent).not.toContain("Consulte tes e-mails");
    expect(view.querySelector('[role="alert"]')).toBeNull(); expect(create).not.toHaveBeenCalled();
  });
  it("skips reads for an already-aborted view and supports direct component disposal", async () => {
    // Arrange
    const f = fixture(); f.controller.abort();
    // Act / Assert
    f.mount(); expect(f.service.latest).not.toHaveBeenCalled();
    const view = createPersonalDataView({ service: f.service }); document.body.append(view); await idle(view);
    disposeComponent(view); expect(f.service.latest).toHaveBeenCalledOnce();
  });
});
