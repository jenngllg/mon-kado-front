// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { createWishImageRecovery } from "../src/features/wishes/wishImageRecovery.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
const { document } = globalThis;

afterEach(() => document.body.replaceChildren());
function fixture() {
  const controller = new AbortController(), onUnavailable = vi.fn();
  const data = [{id:"one",imageUrl:"https://api.test/photo?token=fresh",imageUnavailable:false}];
  const load = vi.fn(async () => data);
  const recovery = createWishImageRecovery({load,signal:controller.signal,onUnavailable});
  const card = document.createElement("li"); card.innerHTML='<h3>Original name</h3><div class="wish-card__media"></div>'; document.body.append(card);
  return {recovery,controller,onUnavailable,load,card,data};
}
it("shares one read across simultaneous failures and changes only the failed media", async () => {
  const f=fixture(), gate=barrier(); f.load.mockImplementation(async()=>{await gate.promise;return f.data;});
  const second=f.card.cloneNode(true); document.body.append(second);
  const first=f.recovery.recover("one",f.card), duplicate=f.recovery.recover("one",f.card), other=f.recovery.recover("two",/** @type {HTMLElement} */(second));
  expect(f.load).toHaveBeenCalledExactlyOnceWith(f.controller.signal); gate.resolve(); await Promise.all([first,duplicate,other]);
  expect(f.card.querySelector("h3")?.textContent).toBe("Original name"); expect(f.card.querySelector("img")?.src).toContain("token=fresh"); expect(/** @type {HTMLElement} */(second).querySelector("img")).toBeNull();
  f.card.querySelector("img")?.dispatchEvent(new Event("error")); await f.recovery.recover("one",f.card); expect(f.load).toHaveBeenCalledOnce();
});
it.each(["abort","reset","detached"])("ignores a late media response after %s",async outcome=>{
  const f=fixture(),gate=barrier(); f.load.mockImplementation(async()=>{await gate.promise;return f.data;});
  const read=f.recovery.recover("one",f.card); if(outcome==="abort")f.controller.abort();else if(outcome==="reset")f.recovery.reset();else f.card.remove();
  gate.resolve();await read;expect(f.card.querySelector("img")).toBeNull();expect(f.onUnavailable).not.toHaveBeenCalled();
});
it.each([401,403,404,503])("handles media read HTTP %s without replay or a recovery button",async statusCode=>{
  const f=fixture();f.load.mockRejectedValue(new ApiError({kind:"http",statusCode}));await f.recovery.recover("one",f.card);await f.recovery.recover("one",f.card);
  expect(f.load).toHaveBeenCalledOnce();expect(f.onUnavailable).toHaveBeenCalledTimes(statusCode===503?0:1);expect(f.card.querySelector("button")).toBeNull();
});
it("starts a new media generation only after its parent accepts a fresh page read",async()=>{
  const f=fixture();f.controller.abort();await f.recovery.recover("one",f.card);expect(f.load).not.toHaveBeenCalled();
  const active=fixture();await active.recovery.recover("one",active.card);active.recovery.reset();await active.recovery.recover("one",active.card);expect(active.load).toHaveBeenCalledTimes(2);
});
