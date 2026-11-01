// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createActivityView } from "../src/features/admin/activityView.js";
import { disposeComponent } from "../src/components/index.js";
import { barrier } from "./sessionTestHelpers.js";
const {document}=globalThis;

/** @type {HTMLElement[]} */ const views=[];
afterEach(()=>{views.splice(0).forEach(disposeComponent);document.body.replaceChildren();});
/** @param {ReturnType<typeof vi.fn>} request Mock transport. @param {AbortSignal} [signal] View lifetime. */
function mount(request,signal=new AbortController().signal){
  const session=/** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({request}));
  const view=createActivityView(session,signal);document.body.append(view);views.push(view);return view;
}
/** @param {HTMLElement} view Journal. @param {string} label Action. */
function button(view,label){const value=[...view.querySelectorAll("button")].find(item=>item.textContent===label);if(!value)throw new Error(label);return value;}

const page = { items: [{ id: "1", displayName: "Élodie", displayNameTag: "1234", occurredAt: "2026-10-31T12:00:00Z", kind: "pageVisit", activity: "Liste du groupe" }], currentPage: 1, totalPages: 1, totalCount: 1, hasPreviousPage: false, hasNextPage: false };

describe("member activity", () => {
  it("shows sanitized payloads as text and filters by log level", async () => {
    const request = vi.fn().mockResolvedValue({status:200,data:{...page,items:[{...page.items[0],logLevel:"error",payload:{name:"<img src=x onerror=alert(1)>",password:"[REDACTED]"}}]}});
    const controller = new AbortController(), view = mount(request, controller.signal);
    await vi.waitFor(() => expect(view.querySelector("pre")?.textContent).toContain("[REDACTED]"));
    expect(view.textContent).toContain("Niveau : Erreur");
    expect(view.querySelector("pre img")).toBeNull();
    expect(view.querySelector("summary")?.textContent).toBe("Voir le payload");
    const level = /** @type {HTMLSelectElement} */ (view.querySelectorAll("select")[1]); level.value = "error";
    view.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1][0]).toContain("logLevel=error");
    controller.abort(); expect(view.querySelector("pre")).toBeNull();
  });
  it("keeps historical entries without a payload readable", async () => {
    const view = mount(vi.fn().mockResolvedValue({status:200,data:{...page,items:[{...page.items[0],logLevel:"info",payload:null}]}}));
    await vi.waitFor(() => expect(view.textContent).toContain("Niveau : Information"));
    expect(view.querySelector("details")).toBeNull();
  });
  it("paginates the journal and returns to the first page when filters change",async()=>{
    const request=vi.fn().mockResolvedValueOnce({status:200,data:{...page,totalCount:2,totalPages:2,hasNextPage:true}})
      .mockResolvedValueOnce({status:200,data:{...page,currentPage:2,totalCount:2,totalPages:2,hasPreviousPage:true,items:[{...page.items[0],kind:"action",activity:"Liste créée"}]}})
      .mockResolvedValue({status:200,data:{...page,items:[],totalCount:0,totalPages:0}});
    const view=mount(request);await vi.waitFor(()=>expect(button(view,"Suivant").disabled).toBe(false));
    button(view,"Suivant").click();await vi.waitFor(()=>expect(view.textContent).toContain("Action · Liste créée"));
    expect(request.mock.calls[1][0]).toContain("page=2");button(view,"Précédent").click();
    await vi.waitFor(()=>expect(view.textContent).toContain("Aucune activité ne correspond"));expect(request.mock.calls[2][0]).toContain("page=1");
    view.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));
    await vi.waitFor(()=>expect(request).toHaveBeenCalledTimes(4));expect(request.mock.calls[3][0]).toContain("page=1");
  });
  it.each([{status:503,data:null},{status:200,data:null},{status:200,data:{items:{}}}])("offers an explicit retry after an invalid journal response: %j",async response=>{
    const request=vi.fn().mockResolvedValueOnce(response).mockResolvedValueOnce({status:200,data:page}),view=mount(request);
    await vi.waitFor(()=>expect(view.querySelector('[role="alert"]')?.textContent).toBe("Impossible de charger l’activité."));
    expect(request).toHaveBeenCalledOnce();button(view,"Réessayer").click();await vi.waitFor(()=>expect(view.textContent).toContain("Élodie #1234"));expect(request).toHaveBeenCalledTimes(2);
  });
  it("discards a previous filter response and aborts private reads when the view closes",async()=>{
    const gate=barrier(),request=vi.fn().mockImplementationOnce(async()=>{await gate.promise;return {status:200,data:page};}).mockResolvedValueOnce({status:200,data:{...page,items:[],totalCount:0,totalPages:0}});
    const controller=new AbortController(),view=mount(request,controller.signal);
    view.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));
    await vi.waitFor(()=>expect(view.textContent).toContain("Aucune activité ne correspond"));
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);gate.resolve();
    await vi.waitFor(()=>expect(view.textContent).not.toContain("Élodie"));controller.abort();expect(view.querySelector("article")).toBeNull();
  });
  it("never reads private activity for an already closed route",()=>{
    const request=vi.fn(),controller=new AbortController();controller.abort();mount(request,controller.signal);expect(request).not.toHaveBeenCalled();
  });
  it("does not disclose a late read failure after leaving the private journal",async()=>{
    const gate=barrier(),late=gate.promise.then(()=>{throw new Error("Private provider detail");});
    const request=vi.fn(()=>late),controller=new AbortController(),view=mount(request,controller.signal);
    controller.abort();gate.resolve();await late.catch(()=>{});
    expect(view.querySelector('[role="alert"]')).toBeNull();expect(view.textContent).not.toContain("Private provider detail");
  });
  it("displays member visits and submits filters to the server", async () => {
    const request = vi.fn(async (/** @type {string} */ path, /** @type {unknown} */ options) => { void path; void options; return { status: 200, data: page, metadata: {} }; });
    const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request }));
    const view = createActivityView(session, new AbortController().signal);
    await vi.waitFor(() => expect(view.textContent).toContain("Élodie #1234"));
    expect(view.textContent).toContain("Visite · Liste du groupe");
    const search = /** @type {HTMLInputElement} */ (view.querySelector('input[type="search"]'));
    const select = /** @type {HTMLSelectElement} */ (view.querySelector("select"));
    search.value = "eloDIE"; select.value = "pageVisit";
    view.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1][0]).toContain("q=eloDIE");
    expect(request.mock.calls[1][0]).toContain("kind=pageVisit");
    disposeComponent(view); view.remove();
  });
});
