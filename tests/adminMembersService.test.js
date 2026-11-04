import {describe,it,expect,vi} from "vitest";
import {createAdminMembersService} from "../src/features/admin/adminMembersService.js";

const id="019c52dd-56c1-7cc6-8a95-243f3a032e76",other="019c52dd-56c1-7cc6-8a95-243f3a032e77";
const member={id,displayName:"Camille",displayNameTag:"1234"};
describe("administrative account transport",()=>{
  it.each([null,{...member,id:"invalid"},{...member,displayName:null},{...member,displayName:" "},{...member,displayNameTag:"123"}])("rejects an unsafe listed identity: %j",async value=>{
    const request=vi.fn().mockResolvedValue({status:200,data:{items:[value],currentPage:1,pageSize:20,totalCount:1,totalPages:1,hasPreviousPage:false,hasNextPage:false}});
    await expect(createAdminMembersService({request}).load({page:1,q:"",signal:new AbortController().signal})).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it.each([{items:null},{currentPage:2},{pageSize:100},{totalCount:-1},{totalCount:0.5},{hasPreviousPage:null},{hasNextPage:null}])("rejects inconsistent account pagination: %j",async patch=>{
    const request=vi.fn().mockResolvedValue({status:200,data:{items:[],currentPage:1,pageSize:20,totalCount:0,totalPages:0,hasPreviousPage:false,hasNextPage:false,...patch}});
    await expect(createAdminMembersService({request}).load({page:1,q:"",signal:new AbortController().signal})).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it("refuses invalid target identifiers before sending any request",async()=>{
    const request=vi.fn(),service=createAdminMembersService({request}),signal=new AbortController().signal;
    await expect(service.loadOne("invalid",signal)).rejects.toThrow(TypeError);await expect(service.erase("invalid","SUPPORT",signal)).rejects.toThrow(TypeError);expect(request).not.toHaveBeenCalled();
  });
  it.each([201,202])("does not accept an unexpected %s response to account erasure",async status=>{
    const request=vi.fn().mockResolvedValue({status});await expect(createAdminMembersService({request}).erase(id,"SUPPORT",new AbortController().signal)).rejects.toMatchObject({kind:"invalidResponse"});expect(request).toHaveBeenCalledOnce();
  });
  it("rejects an unexpected status before rendering a selected account",async()=>{
    const request=vi.fn().mockResolvedValue({status:202,data:member});await expect(createAdminMembersService({request}).loadOne(id,new AbortController().signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it("uses the authenticated versioned API and exact confirmation without retry",async()=>{
    const request=vi.fn().mockResolvedValueOnce({status:200,data:member}).mockResolvedValueOnce({status:204,data:null});
    const service=createAdminMembersService({request}),signal=new AbortController().signal;
    expect(await service.loadOne(id,signal)).toEqual(member);await service.erase(id,"SUPPORT-42",signal);
    expect(request).toHaveBeenNthCalledWith(1,`/api/v1/admin/members/${id}`,{method:"GET",authentication:"required",signal});
    expect(request).toHaveBeenNthCalledWith(2,`/api/v1/admin/members/${id}/erasure-requests`,{method:"POST",authentication:"required",csrf:true,expectEmptyResponse:true,body:{confirmedMemberId:id,requestReference:"SUPPORT-42"},signal});expect(request).toHaveBeenCalledTimes(2);
  });
  it.each([{...member,id:other},{...member,displayNameTag:"bad"},null])("rejects an invalid or mismatched target: %j",async data=>{
    const request=vi.fn().mockResolvedValue({status:200,data});
    await expect(createAdminMembersService({request}).loadOne(id,new AbortController().signal)).rejects.toMatchObject({kind:"invalidResponse"});expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects inconsistent list metadata before exposing account actions",async()=>{
    const request=vi.fn().mockResolvedValue({status:200,data:{items:[member],currentPage:1,pageSize:20,totalCount:1,totalPages:0,hasPreviousPage:false,hasNextPage:false}});
    await expect(createAdminMembersService({request}).load({page:1,q:"",signal:new AbortController().signal})).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it("never replays an uncertain mutation",async()=>{
    const request=vi.fn().mockRejectedValue(new Error("network"));
    await expect(createAdminMembersService({request}).erase(id,"SUPPORT-42",new AbortController().signal)).rejects.toThrow("network");expect(request).toHaveBeenCalledTimes(1);
  });
});

const accountSummary={...member,createdAt:"2026-11-04T08:00:00Z",listCount:2,groupCount:3,wishCount:42,hasAddedViaExtension:true};
it.each([true,false,null])("retains accurate account statistics and extension usage %s",async used=>{
  const row={...accountSummary,hasAddedViaExtension:used};const request=vi.fn().mockResolvedValue({status:200,data:{items:[row],currentPage:1,pageSize:20,totalCount:1,totalPages:1,hasPreviousPage:false,hasNextPage:false}});
  const result=await createAdminMembersService({request}).load({page:1,q:"",signal:new AbortController().signal});expect(result.items).toEqual([row]);expect(Object.isFrozen(result.items[0])).toBe(true);
});
it.each([{createdAt:"invalid"},{listCount:-1},{groupCount:0.5},{wishCount:"3"},{hasAddedViaExtension:"true"}])("rejects malformed account statistics %j",async patch=>{
 const request=vi.fn().mockResolvedValue({status:200,data:{items:[{...accountSummary,...patch}],currentPage:1,pageSize:20,totalCount:1,totalPages:1,hasPreviousPage:false,hasNextPage:false}});
 await expect(createAdminMembersService({request}).load({page:1,q:"",signal:new AbortController().signal})).rejects.toMatchObject({kind:"invalidResponse"});
});
