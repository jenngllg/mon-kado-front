// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { openGroupShareDialog } from "../src/features/groups/groupShareDialog.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

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
  expect(parent.textContent).toContain("Désactiver le lien et le code");
});

it("activates an absent group invitation only on an explicit member action",async()=>{
  const parent=document.createElement("section"),trigger=document.createElement("button");parent.append(trigger);document.body.append(parent);
  const joinLink=vi.fn(async()=>{throw new ApiError({kind:"http",statusCode:404,errorCode:"GROUP_JOIN_LINK_NOT_FOUND"});});
  const createJoinLink=vi.fn(async()=>({link,etag:'"new"'})),revokeJoinLink=vi.fn();
  openGroupShareDialog({parent,trigger,signal:new AbortController().signal,groupId:id,group,apiBaseUrl:"https://api.example",service:{joinLink,createJoinLink,revokeJoinLink}});
  await settle();expect(createJoinLink).not.toHaveBeenCalled();
  /** @type {HTMLButtonElement} */ ([...parent.querySelectorAll("button")].find(button=>button.textContent==="Activer le partage")).click();await settle();
  expect(createJoinLink).toHaveBeenCalledOnce();expect(parent.querySelector('[aria-label="QR code pour rejoindre le groupe"]')).not.toBeNull();expect(revokeJoinLink).not.toHaveBeenCalled();
});

it("deactivates the invitation with its current version and shows the inactive state",async()=>{
  const parent=document.createElement("section"),trigger=document.createElement("button");parent.append(trigger);document.body.append(parent);
  const joinLink=vi.fn(async()=>({link,etag:'"current"'})),revokeJoinLink=vi.fn(async()=>{});
  openGroupShareDialog({parent,trigger,signal:new AbortController().signal,groupId:id,group,apiBaseUrl:"https://api.example",service:{joinLink,createJoinLink:vi.fn(),revokeJoinLink}});
  await settle();/** @type {HTMLButtonElement} */ ([...parent.querySelectorAll("button")].find(button=>button.textContent==="Désactiver le lien et le code")).click();await settle();
  expect(revokeJoinLink).toHaveBeenCalledExactlyOnceWith(id,{etag:'"current"',signal:expect.any(AbortSignal)});
  expect(parent.textContent).toContain("Activer le partage");expect(parent.querySelector("svg.group-share-qr")).toBeNull();
});

it("verifies an uncertain invitation revocation without replaying it",async()=>{
  const parent=document.createElement("section"),trigger=document.createElement("button");parent.append(trigger);document.body.append(parent);
  const joinLink=vi.fn(async()=>({link,etag:'"current"'})),revokeJoinLink=vi.fn(async()=>{throw new ApiError({kind:"network"});});
  openGroupShareDialog({parent,trigger,signal:new AbortController().signal,groupId:id,group,apiBaseUrl:"https://api.example",service:{joinLink,createJoinLink:vi.fn(),revokeJoinLink}});
  await settle();/** @type {HTMLButtonElement} */ ([...parent.querySelectorAll("button")].find(button=>button.textContent==="Désactiver le lien et le code")).click();await settle();
  expect(revokeJoinLink).toHaveBeenCalledOnce();expect(joinLink).toHaveBeenCalledTimes(2);expect(parent.querySelector('[role="alert"]')).not.toBeNull();
});

it("keeps the group sharing dialog open while a mutation is pending and discards it on departure",async()=>{
  const parent=document.createElement("section"),trigger=document.createElement("button"),controller=new AbortController(),gate=barrier();parent.append(trigger);document.body.append(parent);
  const joinLink=vi.fn(async()=>({link,etag:'"current"'})),revokeJoinLink=vi.fn(async()=>{await gate.promise;});
  openGroupShareDialog({parent,trigger,signal:controller.signal,groupId:id,group,apiBaseUrl:"https://api.example",service:{joinLink,createJoinLink:vi.fn(),revokeJoinLink}});
  await settle();/** @type {HTMLButtonElement} */ ([...parent.querySelectorAll("button")].find(button=>button.textContent==="Désactiver le lien et le code")).click();await settle();
  const dialog=/** @type {HTMLDialogElement} */ (parent.querySelector("dialog"));dialog.dispatchEvent(new Event("cancel",{cancelable:true}));expect(dialog.open).toBe(true);
  controller.abort();gate.resolve();await settle();expect(parent.querySelector("dialog")).toBeNull();expect(joinLink).toHaveBeenCalledOnce();
});
