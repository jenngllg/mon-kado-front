import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createGroupSuggestionsService } from "../src/features/groups/groupSuggestionsService.js";
const { btoa } = globalThis;

const groupId="019c52dd-56c1-7cc6-8a95-243f3a032e04", wishlistId="019c52dd-56c1-7cc6-8a95-243f3a032e05", id="019c52dd-56c1-7cc6-8a95-243f3a032e06";
const base=`/api/v1/groups/${groupId}/wishlists/${wishlistId}/suggestions`, tag='"00000001"';
const idea={id,name:"Un livre",note:null,url:null,price:null,quantity:2,reservedQuantity:0,currentParticipantReservedQuantity:0,authorId:groupId,authorDisplayName:"Emma",canEdit:true,hasImage:false,createdAt:"2026-10-31T10:00:00Z",updatedAt:null,entityTag:tag};
const values={name:" Un livre ",note:"",url:"",price:"",quantity:"2"};
/** @param {unknown} data @param {number} [status] @param {string|null} [etag] @param {string|null} [location] */
function response(data,status=200,etag=tag,location=null) {return {data,status,metadata:{etag,location,correlationId:"test",retryAfterSeconds:null}};}
/** @param {ReturnType<typeof vi.fn>} request */
function setup(request) {return createGroupSuggestionsService({request:/** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request)},{groupId,wishlistId});}

describe("group suggestion transport",()=>{
  it("sends validated creation fields with authenticated CSRF and verifies the new location",async()=>{
    const request=vi.fn(async()=>response(idea,201,tag,`${base}/${id}`)), service=setup(request), signal=new AbortController().signal;
    expect(await service.create(values,signal)).toMatchObject({id,name:"Un livre"});
    expect(request).toHaveBeenCalledExactlyOnceWith(base,expect.objectContaining({method:"POST",authentication:"required",csrf:true,body:{name:"Un livre",note:null,url:null,price:null,quantity:2},signal}));
  });
  it("rejects invalid input and malformed suggestion responses",async()=>{
    const request=vi.fn(async()=>response([{...idea,reservedQuantity:3}])), service=setup(request), signal=new AbortController().signal;
    await expect(service.create({...values,name:""},signal)).rejects.toMatchObject({statusCode:400}); expect(request).not.toHaveBeenCalled();
    await expect(service.list(signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it.each([
    ["missing id",{id:"bad"}], ["blank name",{name:"  "}], ["invalid note",{note:3}], ["invalid link",{url:4}],
    ["invalid price",{price:-1}], ["invalid quantity",{quantity:0}], ["too many",{quantity:101}],
    ["negative reserved",{reservedQuantity:-1}], ["over-reserved",{reservedQuantity:3}],
    ["negative personal",{currentParticipantReservedQuantity:-1}], ["excess personal",{currentParticipantReservedQuantity:1}],
    ["invalid author",{authorId:"bad"}], ["invalid author name",{authorDisplayName:""}], ["invalid permission",{canEdit:"yes"}],
    ["invalid image flag",{hasImage:1}], ["invalid creation time",{createdAt:null}], ["invalid update time",{updatedAt:1}], ["invalid version",{entityTag:"bad"}],
  ])("rejects %s from a suggestion read",async(_label,change)=>{
    const service=setup(vi.fn(async()=>response([{...idea,...change}])));
    await expect(service.list(new AbortController().signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it.each([
    {name:""},{note:"a".repeat(501)},{url:"javascript:alert(1)"},{price:"-1"},{quantity:"101"},
  ])("rejects invalid editable fields before any request: %o",async change=>{
    const request=vi.fn(),service=setup(request);
    await expect(service.create({...values,...change},new AbortController().signal)).rejects.toMatchObject({statusCode:400});
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects duplicate identifiers and foreign scoped details",async()=>{
    const request=vi.fn().mockResolvedValueOnce(response([idea,idea])).mockResolvedValueOnce(response({...idea,id:groupId}));
    const service=setup(request),signal=new AbortController().signal;
    await expect(service.list(signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.get(id,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.get("bad",signal)).rejects.toMatchObject({statusCode:404});
  });
  it("requires a matching strong version and location before accepting a mutation",async()=>{
    const request=vi.fn(async()=>response(idea,201,null,`${base}/${id}`)), service=setup(request), signal=new AbortController().signal;
    await expect(service.create(values,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    request.mockResolvedValueOnce(response(idea,201,tag,"/wrong"));
    await expect(service.create(values,signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it("rejects incorrect status codes, missing versions and foreign updates",async()=>{
    const request=vi.fn().mockResolvedValueOnce(response(idea,200)).mockResolvedValueOnce(response(null,200))
      .mockResolvedValueOnce(response(idea,201)).mockResolvedValueOnce(response(idea,200,null))
      .mockResolvedValueOnce(response({...idea,id:groupId}));
    const service=setup(request),signal=new AbortController().signal;
    await expect(service.create(values,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.list(signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.get(id,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.get(id,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.update(id,values,tag,signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it("reads images only over authenticated group requests and checks WebP content",async()=>{
    const content=btoa("RIFF0000WEBP"), request=vi.fn(async()=>response({content})), service=setup(request), signal=new AbortController().signal;
    expect((await service.image(id,signal)).type).toBe("image/webp");
    expect(request).toHaveBeenCalledWith(`${base}/${id}/image`,{authentication:"required",signal});
    request.mockResolvedValueOnce(response({content:btoa("not an image")}));
    await expect(service.image(id,signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it("updates and deletes an idea with its version and verifies image writes",async()=>{
    const withImage={...idea,hasImage:true,entityTag:'"00000002"'};
    const request=vi.fn().mockResolvedValueOnce(response(idea)).mockResolvedValueOnce(response(withImage,200,withImage.entityTag))
      .mockResolvedValueOnce(response(null,204,'"00000003"')).mockResolvedValueOnce(response(null,204));
    const service=setup(request),signal=new AbortController().signal;
    await service.update(id,values,tag,signal);
    expect(request).toHaveBeenLastCalledWith(`${base}/${id}`,expect.objectContaining({method:"PUT",ifMatch:tag,csrf:true}));
    const uploaded=await service.uploadImage(id,new Blob(["image"]),tag,signal);
    expect(uploaded.hasImage).toBe(true);
    expect(request).toHaveBeenLastCalledWith(`${base}/${id}/image`,expect.objectContaining({method:"PUT",formData:expect.any(FormData),ifMatch:tag}));
    expect(await service.removeImage(id,uploaded.entityTag,signal)).toBe('"00000003"');
    await service.remove(id,'"00000003"',signal);
    expect(request).toHaveBeenLastCalledWith(`${base}/${id}`,expect.objectContaining({method:"DELETE",ifMatch:'"00000003"'}));
  });
  it("rejects inconsistent mutation responses and does not treat arbitrary 404s as absent reservations",async()=>{
    const request=vi.fn().mockResolvedValueOnce(response({...idea,hasImage:false})).mockResolvedValueOnce(response(null,200))
      .mockRejectedValueOnce(new ApiError({kind:"http",statusCode:404,errorCode:"GROUP_SUGGESTION_NOT_FOUND"}))
      .mockResolvedValueOnce(response({id:groupId,wishId:id,quantity:1},201));
    const service=setup(request),signal=new AbortController().signal;
    await expect(service.uploadImage(id,new Blob(["x"]),tag,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.remove(id,tag,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.reservation(id,signal)).rejects.toMatchObject({errorCode:"GROUP_SUGGESTION_NOT_FOUND"});
    await expect(service.reserve(id,2,null,signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it("checks image response envelopes and reservation updates before accepting them",async()=>{
    const request=vi.fn().mockResolvedValueOnce(response(idea,201)).mockResolvedValueOnce(response(idea,200,null))
      .mockResolvedValueOnce(response(null,204,null)).mockResolvedValueOnce(response({content:"***"}))
      .mockResolvedValueOnce(response({id:groupId,wishId:id,quantity:1})).mockResolvedValueOnce(response(null,200));
    const service=setup(request),signal=new AbortController().signal;
    await expect(service.uploadImage(id,new Blob(["x"]),tag,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.uploadImage(id,new Blob(["x"]),tag,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.removeImage(id,tag,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    await expect(service.image(id,signal)).rejects.toMatchObject({kind:"invalidResponse"});
    const reservation=await service.reserve(id,1,tag,signal); expect(reservation.quantity).toBe(1);
    await expect(service.cancel(id,tag,signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it("rejects invalid scope and ignores a response that arrives after cancellation",async()=>{
    expect(()=>createGroupSuggestionsService({request:/** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (vi.fn())},{groupId:"bad",wishlistId})).toThrow(TypeError);
    let finish=/** @type {(value:ReturnType<typeof response>)=>void} */ (()=>{});
    const request=vi.fn(()=>new Promise(resolve=>{finish=resolve;})),service=setup(request),controller=new AbortController();
    const pending=service.list(controller.signal); controller.abort(); finish(response([idea]));
    await expect(pending).rejects.toMatchObject({name:"AbortError"});
  });
  it("uses the exact scoped reservation, preserving versions for cancellation",async()=>{
    const request=vi.fn().mockRejectedValueOnce(new ApiError({kind:"http",statusCode:404,errorCode:"GIFT_RESERVATION_NOT_FOUND"}))
      .mockResolvedValueOnce(response({id:groupId,wishId:id,quantity:2},201)).mockResolvedValueOnce(response(null,204));
    const service=setup(request),signal=new AbortController().signal;
    expect(await service.reservation(id,signal)).toBeNull();
    const reservation=await service.reserve(id,2,null,signal); await service.cancel(id,reservation.etag,signal);
    expect(request).toHaveBeenLastCalledWith(`${base}/${id}/reservations/current`,expect.objectContaining({method:"DELETE",ifMatch:tag,csrf:true,authentication:"required"}));
  });
  it("does not dispatch reads after the view is aborted",async()=>{
    const request=vi.fn(),service=setup(request),controller=new AbortController(); controller.abort();
    await expect(service.list(controller.signal)).rejects.toMatchObject({name:"AbortError"}); expect(request).not.toHaveBeenCalled();
  });
});
