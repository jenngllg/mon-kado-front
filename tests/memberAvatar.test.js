// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemberAvatar } from "../src/components/memberAvatar.js";
import { disposeComponent } from "../src/components/componentLifecycle.js";
import { createApplicationShell } from "../src/app/applicationShell.js";
import { createMemberSearchService } from "../src/features/members/memberSearchService.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const url = `http://localhost:7000/api/v1/members/${id}/profile/image?imageId=019c52dd-56c1-7cc6-8a95-243f3a032e05`;
afterEach(() => { for (const child of document.body.children) if (child instanceof HTMLElement) disposeComponent(child); document.body.replaceChildren(); });
describe("member avatars", () => {
  it("generates the same decorative symmetric motif for a canonical identity", () => {
    const first = createMemberAvatar({memberId:id,size:56});
    const second = createMemberAvatar({memberId:id.toUpperCase(),size:32});
    expect(first.querySelector('svg')?.outerHTML).toBe(second.querySelector('svg')?.outerHTML);
    expect(first.getAttribute('aria-hidden')).toBe('true'); expect(first.querySelector('svg')?.getAttribute('focusable')).toBe('false');
    expect(first.style.getPropertyValue('--avatar-size')).toBe('56px'); expect(first.querySelector('img')).toBeNull();
    expect(first.outerHTML).not.toContain(id);
    const cells = [...first.querySelectorAll('rect')]; expect(cells).toHaveLength(25);
    for (const cell of cells) expect(cells.find(other => other.getAttribute('x') === String(4-Number(cell.getAttribute('x'))) && other.getAttribute('y') === cell.getAttribute('y'))?.getAttribute('fill')).toBe(cell.getAttribute('fill'));
  });
  it("keeps fallback while loading, reveals a photo, then handles failure without retry", () => {
    const onError = vi.fn(); const avatar = createMemberAvatar({memberId:id,imageUrl:url,size:56,onError}); document.body.append(avatar);
    const image = /** @type {HTMLImageElement} */ (avatar.querySelector('img'));
    expect(image.hidden).toBe(true); expect(image.alt).toBe(''); expect(image.referrerPolicy).toBe('no-referrer');
    image.dispatchEvent(new Event('load')); expect(image.hidden).toBe(false);
    image.dispatchEvent(new Event('error')); expect(image.hidden).toBe(true); expect(image.hasAttribute('src')).toBe(false);
    image.dispatchEvent(new Event('error')); image.dispatchEvent(new Event('load')); expect(onError).toHaveBeenCalledOnce(); expect(image.hidden).toBe(true);
    disposeComponent(avatar); image.dispatchEvent(new Event('error')); expect(onError).toHaveBeenCalledOnce(); expect(avatar.querySelector('img')).toBeNull();
  });
  it("updates a shell avatar in place without stealing focus or closing mobile navigation", () => {
    const shell = createApplicationShell({apiBaseUrl:'http://localhost:7000'}); document.body.append(shell.element);
    /** @type {import('../src/auth/sessionManager.js').SessionSnapshot} */
    const state = {status:'authenticated',user:{id,displayName:'Jenn',email:'test@example.test',roles:['member'],profileImageUrl:url},etag:'"a"',issue:null,logoutPending:false};
    shell.setSession(state);
    const link = /** @type {HTMLAnchorElement} */ (shell.element.querySelector('a[href="/profile"]')); link.focus();
    const menu = /** @type {HTMLButtonElement} */ (shell.element.querySelector('.app-menu-button')); menu.click();
    const previous = /** @type {HTMLImageElement} */ (link.querySelector('img'));
    shell.setSession({...state,user:{...state.user, id, displayName:'Autre nom', email:'test@example.test',roles:['member'],profileImageUrl:null}});
    expect(document.activeElement).toBe(link); expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(previous.hasAttribute('src')).toBe(false); expect(link.querySelector('svg')).not.toBeNull(); expect(link.textContent).toBe('Mon profil');
    shell.setSession({...state,authenticationPending:true}); expect(link.querySelector('.member-avatar')).toBeNull();
    shell.setSession(state); expect(link.querySelector('img')).not.toBeNull();
    shell.setSession({...state,status:'anonymous',user:null}); expect(shell.element.querySelector('.member-avatar')).toBeNull();
  });
  it("clears an old account image before displaying the next member and ignores its late load", () => {
    const shell = createApplicationShell({apiBaseUrl:'http://localhost:7000'}); document.body.append(shell.element);
    /** @type {import('../src/auth/sessionManager.js').SessionSnapshot} */
    const state = {status:'authenticated',user:{id,displayName:'Jenn',email:'test@example.test',roles:['member'],profileImageUrl:url},etag:'"a"',issue:null,logoutPending:false};
    shell.setSession(state); const old = /** @type {HTMLImageElement} */ (shell.element.querySelector('.member-avatar img'));
    const motif = shell.element.querySelector('.member-avatar svg')?.outerHTML;
    shell.setSession({...state,user:{id:id.replace(/04$/,'08'),displayName:'Second compte',email:'second@example.test',roles:['member'],profileImageUrl:null}});
    old.dispatchEvent(new Event('load'));
    expect(old.hasAttribute('src')).toBe(false); expect(old.isConnected).toBe(false);
    expect(shell.element.querySelector('.member-avatar svg')?.outerHTML).not.toBe(motif);
    expect(shell.element.querySelector('.member-avatar img')).toBeNull();
  });
  it.each([null, 'https://other.invalid/photo', url])("projects only a validated search photo %s", async profileImageUrl => {
    const request = vi.fn(async () => ({status:200,data:{items:[{id,displayName:'Jenn',profileImageUrl}],currentPage:1,pageSize:20,totalCount:1},metadata:{etag:null,correlationId:'test',location:null,retryAfterSeconds:null}}));
    const service = createMemberSearchService({request: /** @type {import('../src/auth/sessionManager.js').SessionManager['request']} */(request)}, {apiBaseUrl:'http://localhost:7000'});
    const page = await service.search('Je',{signal:new AbortController().signal});
    expect(page.items[0].photo?.imageUrl).toBe(profileImageUrl === url ? url : null); expect(Object.isFrozen(page.items[0].photo)).toBe(true);
    expect(request).toHaveBeenCalledOnce();
  });
});
