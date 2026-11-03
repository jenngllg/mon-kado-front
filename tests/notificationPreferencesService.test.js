import {describe,it,expect,vi} from "vitest";
import {createNotificationPreferencesService,NotificationPreferenceOptions} from "../src/features/notifications/notificationPreferencesService.js";

/** @typedef {import("../src/features/notifications/notificationPreferencesService.js").NotificationPreferences} Settings */
const settings=/** @type {Settings} */(Object.fromEntries(NotificationPreferenceOptions.map(({key})=>[key,true])));
/** @param {unknown} [data] @param {string|null} [etag] @param {number} [status] */
const response=(data=settings,etag='"00000000"',status=200)=>({status,data,metadata:{etag,correlationId:"test",location:null,retryAfterSeconds:null}});
function setup(value=response()){const request=vi.fn(async()=>value);return{request,service:createNotificationPreferencesService({request:/** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */(request)})};}

describe("notification preferences transport",()=>{
  it("loads a complete frozen preference set with its own version",async()=>{
    const{request,service}=setup();const signal=new AbortController().signal;
    const saved=await service.load(signal);
    expect(saved).toEqual({settings,etag:'"00000000"'});expect(Object.isFrozen(saved.settings)).toBe(true);
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/members/current/notification-preferences",{authentication:"required",signal});
  });
  it.each(NotificationPreferenceOptions.map(({key})=>key))("rejects an omitted %s choice",async key=>{
    const data=/** @type {Record<string,unknown>} */({...settings});delete data[key];const{service}=setup(response(data));
    await expect(service.load(new AbortController().signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it.each([null,[],{},false,{...settings,wishesAdded:null},{...settings,wishesAdded:"true"},{...settings,unknown:true}])("rejects an invalid preference response %j",async data=>{
    const{service}=setup(response(data));await expect(service.load(new AbortController().signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it.each([null,'W/"old"',"not-a-version"])("rejects an unusable version %s",async etag=>{
    const{service}=setup(response(settings,etag));await expect(service.load(new AbortController().signal)).rejects.toMatchObject({kind:"invalidResponse"});
  });
  it("saves explicit false values using CSRF and If-Match",async()=>{
    const wanted=/** @type {Settings} */(Object.fromEntries(NotificationPreferenceOptions.map(({key})=>[key,false])));
    const{request,service}=setup(response(wanted,'"00000001"'));const signal=new AbortController().signal;
    const saved=await service.save(wanted,'"00000000"',signal);expect(saved.settings).toEqual(wanted);
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/members/current/notification-preferences",{method:"PUT",authentication:"required",csrf:true,ifMatch:'"00000000"',body:wanted,signal});
  });
  it("rejects an unexpected saved value without replaying the write",async()=>{
    const{request,service}=setup();await expect(service.save({...settings,wishesAdded:false},'"00000000"',new AbortController().signal)).rejects.toMatchObject({kind:"invalidResponse"});expect(request).toHaveBeenCalledOnce();
  });
  it("rejects invalid local settings and versions before dispatch",async()=>{
    const{request,service}=setup();const signal=new AbortController().signal;
    await expect(service.save(/** @type {Settings} */({}),'"00000000"',signal)).rejects.toThrow(TypeError);
    await expect(service.save(settings,"invalid",signal)).rejects.toThrow(TypeError);expect(request).not.toHaveBeenCalled();
  });
  it("rejects an unexpected successful status",async()=>{
    const{service}=setup(response(settings,'"00000001"',201));await expect(service.load(new AbortController().signal)).rejects.toMatchObject({kind:"invalidResponse",statusCode:201});
  });
});
