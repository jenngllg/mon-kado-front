// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishlistGroupShareDialog } from "../src/features/groups/wishlistGroupShareDialog.js";
import { createGroupsService } from "../src/features/groups/groupsService.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
const {document,HTMLElement,HTMLInputElement}=globalThis;
const id="019c52dd-56c1-7cc6-8a95-243f3a032e04",first="019c52dd-56c1-7cc6-8a95-243f3a032e05",second="019c52dd-56c1-7cc6-8a95-243f3a032e06";
async function settle(){for(let i=0;i<50;i++)await Promise.resolve();}
afterEach(()=>{for(const child of [...document.body.children])if(child instanceof HTMLElement)disposeComponent(child);document.body.replaceChildren();});
/** @param {{isPublic?:boolean,empty?:boolean,fail?:boolean}} [options] */
function setup({isPublic=true,empty=false,fail=false}={}){
  const server={etag:'"v1"',groups:empty?[]:[{groupId:first,name:"Famille",isVisible:isPublic},{groupId:second,name:"Amis <script>",isVisible:isPublic}]};
  const request=vi.fn(async(/** @type {string} */ path,/** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options)=>{
    expect(path).toBe(`/api/v1/wishlists/${id}/group-visibility`);
    if(fail){fail=false;throw new ApiError({kind:"network"});}
    if(options.method==="PUT"){
      const choices=/** @type {{groups:Array<{groupId:string,isVisible:boolean}>}} */ (options.body);
      server.groups=server.groups.map(group=>({...group,isVisible:choices.groups.find(item=>item.groupId===group.groupId)?.isVisible??group.isVisible}));server.etag='"v2"';
    }
    return {status:200,data:{wishlistId:id,isPublic,groups:server.groups.map(group=>({...group}))},metadata:{etag:server.etag,location:null,correlationId:"visibility-test",retryAfterSeconds:null}};
  });
  const service=createGroupsService({request:/** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request)});
  const controller=new AbortController(),onClose=vi.fn();
  const view=createWishlistGroupShareDialog({service,wishlistId:id,signal:controller.signal,onClose});document.body.append(view);view.showModal();
  const checkbox=(/** @type {string} */ groupId)=>{const input=view.querySelector(`input[value="${groupId}"]`);if(!(input instanceof HTMLInputElement))throw new Error(groupId);return input;};
  const button=(/** @type {string} */ label)=>{const b=[...view.querySelectorAll("button")].find(b=>b.textContent===label);if(!b)throw new Error(label);return b;};
  return {view,request,service,controller,onClose,server,checkbox,button};
}
describe("wishlist group visibility",()=>{
  it("shows every public default checked without writing and escapes group names",async()=>{
    const f=setup();await settle();expect(f.checkbox(first).checked).toBe(true);expect(f.checkbox(second).checked).toBe(true);
    expect(f.button("Enregistrer").disabled).toBe(true);expect(f.view.querySelector("script")).toBeNull();expect(f.view.textContent).toContain("Amis <script>");
    expect(f.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/group-visibility`,expect.objectContaining({method:"GET",authentication:"required",csrf:false}));
  });
  it("keeps edits local until one atomic versioned save",async()=>{
    const f=setup();await settle();f.checkbox(first).click();expect(f.request).toHaveBeenCalledOnce();
    f.button("Enregistrer").click();await settle();
    expect(f.request).toHaveBeenLastCalledWith(`/api/v1/wishlists/${id}/group-visibility`,expect.objectContaining({method:"PUT",ifMatch:'"v1"',csrf:true,body:{groups:[{groupId:first,isVisible:false},{groupId:second,isVisible:true}]}}));
    expect(f.onClose).toHaveBeenCalledOnce();expect(f.view.isConnected).toBe(false);
  });
  it("keeps private lists unchecked until the owner explicitly selects a group",async()=>{
    const f=setup({isPublic:false});await settle();expect(f.checkbox(first).checked).toBe(false);expect(f.checkbox(second).checked).toBe(false);
    expect(f.view.textContent).toContain("liste privée");f.checkbox(first).click();f.button("Enregistrer").click();await settle();
    expect(f.server.groups.map(item=>item.isVisible)).toEqual([true,false]);
  });
  it("discards a cancelled draft without saving",async()=>{
    const f=setup();await settle();f.checkbox(first).click();f.button("Fermer").click();await settle();
    expect(f.request).toHaveBeenCalledOnce();expect(f.onClose).toHaveBeenCalledOnce();expect(f.server.groups.every(item=>item.isVisible)).toBe(true);
  });
  it("preserves a conflicting draft, verifies explicitly and uses the fresh version",async()=>{
    const f=setup();await settle();f.checkbox(first).click();
    f.request.mockRejectedValueOnce(new ApiError({kind:"http",statusCode:412,errorCode:"WISHLIST_GROUP_VISIBILITY_VERSION_CONFLICT"}));
    f.button("Enregistrer").click();await settle();expect(f.checkbox(first).checked).toBe(false);expect(f.button("Enregistrer").disabled).toBe(true);
    expect(f.request).toHaveBeenCalledTimes(2);f.server.etag='"newer"';f.button("Vérifier la visibilité").click();await settle();
    expect(f.checkbox(first).checked).toBe(false);expect(f.request.mock.calls.filter(([,options])=>options.method==="PUT")).toHaveLength(1);
    f.button("Enregistrer").click();await settle();expect(f.request).toHaveBeenLastCalledWith(expect.any(String),expect.objectContaining({ifMatch:'"newer"'}));
  });
  it("recovers a failed read without a mutation or duplicate controls",async()=>{
    const f=setup({fail:true});await settle();expect(f.button("Enregistrer").disabled).toBe(true);
    f.button("Vérifier la visibilité").click();await settle();expect(f.view.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(f.request.mock.calls.every(([,options])=>options.method==="GET")).toBe(true);
  });
  it("reports an empty membership set without writable controls",async()=>{
    const f=setup({empty:true});await settle();expect(f.view.textContent).toContain("Rejoins ou crée un groupe");expect(f.button("Enregistrer").disabled).toBe(true);
  });
  it("blocks duplicate submission and Escape during a pending save",async()=>{
    const f=setup();await settle();f.checkbox(first).click();const gate=barrier();
    f.request.mockImplementationOnce(async()=>{await gate.promise;throw new ApiError({kind:"timeout"});});
    f.button("Enregistrer").click();f.view.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));
    f.view.dispatchEvent(new Event("cancel",{cancelable:true}));expect(f.view.open).toBe(true);
    gate.resolve();await settle();expect(f.request.mock.calls.filter(([,options])=>options.method==="PUT")).toHaveLength(1);
  });
  it("ignores a result after page disposal",async()=>{
    const f=setup();await settle();f.controller.abort();expect(f.view.isConnected).toBe(false);expect(f.onClose).not.toHaveBeenCalled();
  });
});
