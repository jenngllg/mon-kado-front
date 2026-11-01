// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminMembersView } from "../src/features/admin/adminMembersView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { isAdministrator } from "../src/auth/roles.js";

const id="019c52dd-56c1-7cc6-8a95-243f3a032e76",self="019c52dd-56c1-7cc6-8a95-243f3a032e77";
const member={id,displayName:"Camille",displayNameTag:"1234"};
const page={items:[member,{...member,id:self}],currentPage:1,pageSize:20,totalCount:2,totalPages:1,hasPreviousPage:false,hasNextPage:false};
/** @type {HTMLElement[]} */ const roots=[];
afterEach(()=>{roots.splice(0).forEach(disposeComponent);document.body.replaceChildren();vi.restoreAllMocks();});
/** @param {{read?:unknown,erase?:unknown,list?:unknown}} [failures] Transport failures. */
function fixture(failures={}){
  const state={erased:false,failures};
  const request=vi.fn(async(/** @type {string} */ path,/** @type {import('../src/api/apiClient.js').ApiRequestOptions} */ options={})=>{
    if(options?.method==="POST"){if(state.failures.erase)throw state.failures.erase;state.erased=true;return {status:204,data:null};}
    if(path===`/api/v1/admin/members/${id}`){if(state.failures.read)throw state.failures.read;if(state.erased)throw http(404);return {status:200,data:member};}
    if(state.failures.list)throw state.failures.list;
    return {status:200,data:{...page,items:state.erased?[]:page.items}};
  });
  const controller=new AbortController();
  const session=/** @type {import('../src/auth/sessionManager.js').SessionManager} */(/** @type {unknown} */({request,getSnapshot:()=>({user:{id:self}})}));
  const view=createAdminMembersView(session,controller.signal);roots.push(view);document.body.append(view);
  return {view,request,state,controller};
}
/** @param {number} statusCode Status. */ function http(statusCode){return new ApiError({kind:"http",statusCode});}
/** @param {HTMLElement} root Root. @param {string} label Exact button label. */
function button(root,label){return /** @type {HTMLButtonElement} */([...root.querySelectorAll("button")].find(item=>item.textContent===label));}
/** @param {ReturnType<typeof fixture>} f Fixture. */
async function open(f){await vi.waitFor(()=>expect(button(f.view,"Supprimer")).toBeTruthy());button(f.view,"Supprimer").click();await vi.waitFor(()=>expect(f.view.querySelector("dialog input:disabled")).toBeNull());}
/** @param {ReturnType<typeof fixture>} f Fixture. */
function confirm(f){const inputs=f.view.querySelectorAll("dialog input");/** @type {HTMLInputElement} */(inputs[0]).value="SUPPORT-42";/** @type {HTMLInputElement} */(inputs[1]).value="Camille #1234";inputs[1].dispatchEvent(new Event("input",{bubbles:true}));}

describe("administrative member deletion view",()=>{
  it("uses only the live administrator boolean",()=>{expect(isAdministrator({isAdmin:true})).toBe(true);expect(isAdministrator({isAdmin:false})).toBe(false);expect(isAdministrator(null)).toBe(false);});
  it("requires the full confirmed handle and a reference, excludes self and reloads after deletion",async()=>{
    const f=fixture();await open(f);expect(f.view.textContent).toContain("Ton compte");expect(f.view.querySelectorAll('button[aria-label^="Supprimer le compte"]')).toHaveLength(1);
    const submit=button(f.view,"Supprimer définitivement");expect(submit.disabled).toBe(true);confirm(f);expect(submit.disabled).toBe(false);submit.click();
    await vi.waitFor(()=>expect(f.view.textContent).toContain("Compte supprimé."));expect(f.view.querySelector("dialog")).toBeNull();expect(f.view.textContent).toContain("Aucun compte trouvé");
    expect(f.request.mock.calls.filter(([,options])=>options?.method==="POST")).toHaveLength(1);
  });
  it.each([401,403])("removes account actions when deletion returns %s",async status=>{
    const f=fixture({erase:http(status)});await open(f);confirm(f);button(f.view,"Supprimer définitivement").click();await vi.waitFor(()=>expect(f.view.textContent).toContain("Accès administrateur refusé"));expect(f.view.querySelector("dialog")).toBeNull();
  });
  it.each([409,400])("keeps a refused %s deletion from being replayed",async status=>{
    const f=fixture({erase:http(status)});await open(f);confirm(f);button(f.view,"Supprimer définitivement").click();await vi.waitFor(()=>expect(f.view.textContent).toContain("Suppression refusée"));expect(button(f.view,"Supprimer définitivement").disabled).toBe(true);button(f.view,"Annuler").click();expect(f.view.querySelector("dialog")).toBeNull();
  });
  it.each([true,false])("checks an uncertain result before allowing another write (deleted: %s)",async erased=>{
    const f=fixture({erase:new Error("lost response")});await open(f);confirm(f);button(f.view,"Supprimer définitivement").click();await vi.waitFor(()=>expect(f.view.textContent).toContain("Résultat incertain"));expect(button(f.view,"Supprimer définitivement").disabled).toBe(true);
    f.state.erased=erased;button(f.view,"Vérifier la suppression").click();await vi.waitFor(()=>expect(f.view.textContent).toContain(erased?"Suppression vérifiée":"Le compte existe encore"));
    expect(f.request.mock.calls.filter(([,options])=>options?.method==="POST")).toHaveLength(1);
    if(!erased){expect(button(f.view,"Supprimer définitivement").disabled).toBe(false);button(f.view,"Annuler").click();}
  });
  it.each([401,404,503])("disables deletion when the fresh identity check returns %s",async status=>{
    const f=fixture({read:http(status)});await open(f);await vi.waitFor(()=>expect(f.view.querySelector('[role="alert"]')).not.toBeNull());
    expect(f.request.mock.calls.every(([,options])=>options?.method!=="POST")).toBe(true);
    if(status===401)expect(f.view.querySelector("dialog")).toBeNull();else expect(button(f.view,"Supprimer définitivement").disabled).toBe(true);
  });
  it.each([401,503])("shows a safe list error for %s and retries only transient failures",async status=>{
    const f=fixture({list:http(status)});await vi.waitFor(()=>expect(f.view.querySelector('[role="alert"]')).not.toBeNull());
    if(status===503){f.state.failures.list=null;button(f.view,"Réessayer").click();await vi.waitFor(()=>expect(button(f.view,"Supprimer")).toBeTruthy());}
    else expect(button(f.view,"Réessayer")).toBeUndefined();
  });
  it("resets search pagination and clears identities when the route ends",async()=>{
    const f=fixture();await vi.waitFor(()=>expect(button(f.view,"Supprimer")).toBeTruthy());const search=/** @type {HTMLInputElement} */(f.view.querySelector('input[type="search"]'));search.value="Camille";f.view.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));
    await vi.waitFor(()=>expect(f.request.mock.calls.some(([path])=>path.includes("q=Camille"))).toBe(true));f.controller.abort();expect(f.view.textContent).not.toContain("Camille #1234");
  });
  it("navigates account pages and returns to page one when searching",async()=>{
    const f=fixture();f.request.mockResolvedValueOnce({status:200,data:{...page,totalCount:21,totalPages:2,hasNextPage:true}});
    // Trigger a new read with the paginated response after the initial in-flight read.
    f.view.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));
    await vi.waitFor(()=>expect(button(f.view,"Suivant")).toBeTruthy());
    f.request.mockResolvedValueOnce({status:200,data:{...page,currentPage:2,totalCount:21,totalPages:2,hasNextPage:false,hasPreviousPage:true}});button(f.view,"Suivant").click();
    await vi.waitFor(()=>expect(button(f.view,"Précédent").disabled).toBe(false));
    button(f.view,"Précédent").click();await vi.waitFor(()=>expect(button(f.view,"Supprimer")).toBeTruthy());
    expect(f.request.mock.calls.some(([path])=>path.includes("page=2"))).toBe(true);
  });
  it("requires reopening when the member handle changes before confirmation",async()=>{
    const f=fixture();await vi.waitFor(()=>expect(button(f.view,"Supprimer")).toBeTruthy());f.request.mockResolvedValueOnce({status:200,data:{...member,displayName:"Renamed"}});button(f.view,"Supprimer").click();
    await vi.waitFor(()=>expect(f.view.textContent).toContain("Le pseudo a changé"));confirm(f);expect(button(f.view,"Supprimer définitivement").disabled).toBe(true);
    f.view.querySelector("dialog")?.dispatchEvent(new Event("cancel",{cancelable:true}));
  });
});
