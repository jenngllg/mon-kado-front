// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGroupShareChannels } from "../src/features/groups/groupShareChannels.js";
import { disposeComponent } from "../src/components/index.js";
import { createGroupsService } from "../src/features/groups/groupsService.js";
import { barrier } from "./sessionTestHelpers.js";

const { document, HTMLElement } = globalThis;

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", code = "ABCDEFGH234567AB";
const link = `https://www.monkado.fr/groups/join/${id}#${code}`;
async function settle() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
afterEach(() => { for (const child of [...document.body.children]) if (child instanceof HTMLElement) disposeComponent(child); document.body.replaceChildren(); vi.restoreAllMocks(); });
/** @param {Partial<Parameters<typeof createGroupShareChannels>[0]>} [options] Explicit platform behavior. */
function setup(options = {}) {
  const status = document.createElement("p"), navigate = vi.fn(), copy = vi.fn(async () => {}), openWindow = vi.fn(() => ({ navigate, close: vi.fn() }));
  const openMail = vi.fn(), shareSystem = vi.fn(async () => {});
  const channels = createGroupShareChannels({ name: "Famille & amis", link, copy, status, openWindow, openMail, shareSystem, ...options });
  document.body.append(channels, status);
  const click = (/** @type {string} */ channel) => /** @type {HTMLButtonElement} */ (channels.querySelector(`[data-share-channel="${channel}"]`)).click();
  return { status, channels, navigate, copy, openWindow, openMail, shareSystem, click };
}
describe("group invitation sharing", () => {
  it("offers a safe explicit fallback when the popup is blocked", async () => {
    const f = setup({ openWindow: () => null }); f.click("x"); await settle();
    const fallback = f.status.querySelector("a");
    expect(fallback?.textContent).toBe("Ouvrir X"); expect(fallback?.target).toBe("_blank");
    expect(fallback?.rel).toBe("noopener noreferrer"); expect(fallback?.referrerPolicy).toBe("no-referrer");
    expect(new URL(fallback?.href ?? "").searchParams.get("text")).toContain(link);
    expect([...f.channels.querySelectorAll("button")].every(button => !button.disabled)).toBe(true);
  });
  it("opens the mobile Messenger composer with the complete invitation", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Android");
    const openMessenger = vi.fn(); const f = setup({ openMessenger }); f.click("messenger");
    expect(openMessenger).toHaveBeenCalledOnce(); expect(decodeURIComponent(openMessenger.mock.calls[0][0])).toContain(link);
    expect(f.openWindow).not.toHaveBeenCalled();
  });
  it("shares on Facebook even when clipboard permission is denied", async () => {
    const f = setup({ copy: async () => { throw new DOMException("Denied", "NotAllowedError"); } });
    f.click("facebook"); await settle(); expect(f.navigate).toHaveBeenCalledOnce(); expect(f.status.textContent).not.toContain("copié");
  });
  it.each([new DOMException("Cancelled", "AbortError"), new Error("Unavailable")])("recovers from a system sharing failure without a second handoff", async error => {
    const f = setup(); f.shareSystem.mockRejectedValueOnce(error); f.click("discord"); await settle();
    expect(f.status.textContent).toBe(error.name === "AbortError" ? "Partage fermé." : "Le partage automatique est indisponible. Tu peux copier le lien.");
    expect(f.shareSystem).toHaveBeenCalledOnce(); expect(f.openWindow).not.toHaveBeenCalled();
    expect([...f.channels.querySelectorAll("button")].every(button => !button.disabled)).toBe(true);
  });
  it("closes a reserved popup if navigation fails", async () => {
    const close = vi.fn(); const f = setup({ openWindow: () => ({ navigate: () => { throw new Error("Blocked"); }, close }) });
    f.click("whatsapp"); await settle(); expect(close).toHaveBeenCalledOnce(); expect(f.status.textContent).toContain("copier le lien");
  });
  it("prevents overlapping shares and drops clipboard completion after disposal", async () => {
    const gate = barrier(); const copy = vi.fn(async () => { await gate.promise; }); const f = setup({ copy });
    f.click("facebook"); f.click("facebook"); expect(copy).toHaveBeenCalledOnce();
    disposeComponent(f.channels); gate.resolve(); await settle(); expect(f.status.textContent).toBe("");
  });
  it("does not publish a late system picker error after disposal", async () => {
    const gate = barrier(); const f = setup({ shareSystem: async () => { await gate.promise; throw new Error("Late failure"); } });
    f.click("discord"); const status = f.status.textContent; disposeComponent(f.channels); gate.resolve(); await settle(); expect(f.status.textContent).toBe(status);
  });
  it("reuses all six list channels and preserves the complete link in the group message", async () => {
    const f = setup(); expect(f.channels.querySelectorAll("button")).toHaveLength(6);
    expect(f.openWindow).not.toHaveBeenCalled(); expect(f.copy).not.toHaveBeenCalled();
    f.click("whatsapp"); await settle();
    const destination = new URL(f.navigate.mock.calls[0]?.[0]);
    expect(destination.origin).toBe("https://wa.me"); expect(destination.searchParams.get("text")).toBe(`Rejoins le groupe « Famille & amis » sur MonKado : ${link}`);
    expect(f.copy).not.toHaveBeenCalled();
  });
  it("keeps the group name and complete code-bearing link for Facebook, e-mail and the system picker", async () => {
    const f = setup(); f.click("facebook"); await settle();
    expect(new URL(f.navigate.mock.calls[0]?.[0]).searchParams.get("u")).toBe(link);
    expect(f.copy).toHaveBeenCalledExactlyOnceWith(`Rejoins le groupe « Famille & amis » sur MonKado : ${link}`);
    f.click("email"); await settle();
    const mail = new URL(f.openMail.mock.calls[0]?.[0]); expect(mail.protocol).toBe("mailto:"); expect(mail.searchParams.get("body")).toContain(link); expect(mail.searchParams.get("subject")).toContain("Famille & amis");
    f.click("discord"); await settle(); expect(f.shareSystem).toHaveBeenCalledExactlyOnceWith({title:"Invitation au groupe « Famille & amis » sur MonKado",text:`Rejoins le groupe « Famille & amis » sur MonKado : ${link}`});
  });
  it("does not emit a late sharing result into a closed dialog", async () => {
    const f = setup(); disposeComponent(f.channels); f.click("whatsapp"); await settle(); expect(f.navigate).not.toHaveBeenCalled();
  });
  it("reads previews without authentication, CSRF, request body or a secret in the URL", async () => {
    const preview = { id, name:"Famille", memberCount:2, profileImageUrl:null };
    const request = vi.fn(async () => ({status:200,data:preview,metadata:{etag:null,correlationId:"preview",location:null,retryAfterSeconds:null}}));
    const service = createGroupsService({request:/** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request)});
    const signal = new AbortController().signal;
    expect(await service.previewJoin(code, {signal})).toEqual(preview);
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/groups/join",{method:"GET",authentication:"none",csrf:false,shareToken:code,signal});
    expect(await service.previewInvitation(id,{signal})).toEqual(preview);
    expect(request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}/preview`,{method:"GET",authentication:"none",csrf:false,signal});
  });
});
