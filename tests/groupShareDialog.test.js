// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { openGroupShareDialog } from "../src/features/groups/groupShareDialog.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";

const { document, HTMLElement } = globalThis;

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", code = "ABCDEFGH234567AB";
const group = { id, ownerId: id, name: "Famille", profileImageUrl: null, memberCount: 1, createdAt: "2026-10-24T12:00:00Z", updatedAt: null };
const link = { groupId: id, code, joinUrl: `https://www.monkado.fr/groups/join/${id}#${code}`, createdAt: group.createdAt };
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
afterEach(() => { for (const child of [...document.body.children]) if (child instanceof HTMLElement) disposeComponent(child); document.body.replaceChildren(); vi.unstubAllGlobals(); });

it("copies the active invitation through the browser clipboard and recovers from a permission denial", async () => {
  const parent = document.createElement("section"), trigger = document.createElement("button"); parent.append(trigger); document.body.append(parent);
  const copy = vi.fn(async () => {}); vi.stubGlobal("navigator", { userAgent: "Windows", clipboard: { writeText: copy } });
  const service = { joinLink: vi.fn(async () => ({ link, etag: '"current"' })), createJoinLink: vi.fn(), revokeJoinLink: vi.fn() };
  openGroupShareDialog({ parent, trigger, signal: new AbortController().signal, groupId: id, group, apiBaseUrl: "https://api.example", owner: true, service });
  await settle();
  const copyLink = /** @type {HTMLButtonElement} */ (parent.querySelector('[aria-label="Copier le lien"]'));
  copyLink.click(); await settle(); expect(copy).toHaveBeenCalledExactlyOnceWith(link.joinUrl); expect(parent.textContent).toContain("Copié !");
  copy.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError")); copyLink.click(); await settle();
  expect(parent.textContent).toContain("La copie a échoué."); expect(service.createJoinLink).not.toHaveBeenCalled(); expect(service.revokeJoinLink).not.toHaveBeenCalled();
});

it("retries a failed invitation read only after an explicit action", async () => {
  const parent = document.createElement("section"), trigger = document.createElement("button"); parent.append(trigger); document.body.append(parent);
  const joinLink = vi.fn(async () => ({ link, etag: '"current"' })).mockRejectedValueOnce(new ApiError({ kind: "network" }));
  openGroupShareDialog({ parent, trigger, signal: new AbortController().signal, groupId: id, group, apiBaseUrl: "https://api.example", owner: false, service: { joinLink, createJoinLink: vi.fn(), revokeJoinLink: vi.fn() } });
  await settle(); expect(parent.querySelector("svg.group-share-qr")).toBeNull();
  /** @type {HTMLButtonElement} */ ([...parent.querySelectorAll("button")].find(button => button.textContent === "Réessayer")).click();
  await settle(); expect(joinLink).toHaveBeenCalledTimes(2); expect(parent.querySelector('[aria-label="QR code pour rejoindre le groupe"]')).not.toBeNull();
  expect(parent.textContent).not.toContain("Désactiver le lien et le code");
});
