import { describe, expect, it, vi } from "vitest";
import { createPersonalReservationsReader, readPersonalReservations } from "../src/features/sharing/personalReservations.js";

const list = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const wish = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const other = "019c52dd-56c1-7cc6-8a95-243f3a032e06";

describe("personal reservation batch reader", () => {
  it("skips empty lists and rejects cancelled or malformed batch responses",async()=>{
    const controller=new AbortController(),request=vi.fn().mockResolvedValue({status:200,data:null});
    const read=createPersonalReservationsReader({request});expect(await read(list,[],controller.signal)).toEqual({quantities:new Map(),failed:false});expect(request).not.toHaveBeenCalled();
    expect((await read(list,[{id:wish}],controller.signal)).failed).toBe(true);
    request.mockResolvedValue({status:200,data:{currentPage:1,pageSize:100,totalCount:1,items:[null]}});expect((await read(list,[{id:wish}],controller.signal)).failed).toBe(true);
    controller.abort();await expect(read(list,[{id:wish}],controller.signal)).rejects.toMatchObject({name:"AbortError"});
  });
  it("keeps concurrent personal lookups bounded and reports only confirmed quantities",async()=>{
    const signal=new AbortController().signal;
    const load=vi.fn().mockResolvedValueOnce({state:"reserved",reservation:{quantity:2}}).mockResolvedValueOnce({state:"absent"}).mockRejectedValueOnce(new Error("network"));
    const result=await readPersonalReservations(list,[{id:wish},{id:other},{id:list}],load,signal);
    expect(result).toEqual({quantities:new Map([[wish,2]]),failed:true});expect(load).toHaveBeenCalledTimes(3);
    const controller=new AbortController();controller.abort();expect(await readPersonalReservations(list,[{id:wish}],load,controller.signal)).toEqual({quantities:new Map(),failed:false});expect(load).toHaveBeenCalledTimes(3);
    const abort=new DOMException("Cancelled","AbortError");load.mockRejectedValueOnce(abort);expect((await readPersonalReservations(list,[{id:wish}],load,signal)).failed).toBe(false);
  });
  it("reads a large wishlist in one request and only shows its own active reservations", async () => {
    const request = vi.fn(async () => ({ status: 200, data: { currentPage: 1, pageSize: 100, totalCount: 2, items: [
      { wishlistId: list, wishId: wish, status: "active", quantity: 2 },
      { wishlistId: other, wishId: wish, status: "active", quantity: 1 },
    ] } }));
    const read = createPersonalReservationsReader(/** @type {any} */ ({ request }));
    const result = await read(list, Array.from({ length: 98 }, () => ({ id: wish })), new AbortController().signal);
    expect(result.failed).toBe(false);
    expect(result.quantities.get(wish)).toBe(2);
    expect(request).toHaveBeenCalledOnce();
  });
  it("reads all pages and reports failures without treating missing data as confirmed", async () => {
    const request = vi.fn(async url => ({ status: 200, data: url.includes("page=2")
      ? { currentPage: 2, pageSize: 100, totalCount: 101, items: [{ wishlistId: list, wishId: wish, status: "active", quantity: 1 }] }
      : { currentPage: 1, pageSize: 100, totalCount: 101, items: [] } }));
    const read = createPersonalReservationsReader(/** @type {any} */ ({ request }));
    expect((await read(list, [{ id: wish }], new AbortController().signal)).quantities.get(wish)).toBe(1);
    expect(request).toHaveBeenCalledTimes(2);
    request.mockRejectedValueOnce(new Error("network"));
    expect(await read(list, [{ id: wish }], new AbortController().signal)).toMatchObject({ failed: true, quantities: new Map() });
  });
});
