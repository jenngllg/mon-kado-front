// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWishImportSuggestions } from "../src/features/wishes/wishImportService.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
vi.mock("../src/features/wishes/wishImageValidation.js", async original => ({ ...await original(), decodeWishImage: vi.fn(async () => {}) }));
const id="019c52dd-56c1-7cc6-8a95-243f3a032e04",url="https://shop.example/product";
const value=()=>({name:"Produit",url,price:"19,99",image:new Blob(["image"],{type:"image/webp"}),warnings:[]});
const revoke=vi.fn();
beforeEach(()=>{vi.useFakeTimers();revoke.mockClear();vi.mocked(decodeWishImage).mockImplementation(async()=>{});vi.stubGlobal("URL",class extends URL{static createObjectURL(){return "blob:imported";}static revokeObjectURL=revoke;});});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("whole wish import deadline",()=>{
  it("cancels a stalled preview within the remaining ten-second UI budget and ignores its late result",async()=>{
    const gate=barrier();let cancelled=false;
    const preview=vi.fn(async(_id,_url,{signal})=>{signal.addEventListener("abort",()=>{cancelled=true;});await gate.promise;return value();});
    const pending=loadWishImportSuggestions(preview,id,url,{signal:new AbortController().signal});
    const rejected=expect(pending).rejects.toMatchObject({kind:"timeout"});
    await vi.advanceTimersByTimeAsync(9749);expect(cancelled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);await rejected;expect(cancelled).toBe(true);
    gate.resolve();await Promise.resolve();expect(revoke).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps retrieved text when image decoding stalls, releases its URL and cancels the decoder",async()=>{
    const gate=barrier();let cancelled=false;
    vi.mocked(decodeWishImage).mockImplementation(async(_url,signal)=>{signal.addEventListener("abort",()=>{cancelled=true;});await gate.promise;});
    const pending=loadWishImportSuggestions(async()=>value(),id,url,{signal:new AbortController().signal});
    await vi.advanceTimersByTimeAsync(9750);const result=await pending;
    expect(result).toMatchObject({name:"Produit",price:"19,99",image:null,previewImageUrl:null});
    expect(result.warnings.join(" ")).toContain("image utilisable");expect(cancelled).toBe(true);expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:imported");
    gate.resolve();await Promise.resolve();expect(revoke).toHaveBeenCalledTimes(1);
  });
  it("transfers a validated image URL to the caller and removes the deadline",async()=>{
    const result=await loadWishImportSuggestions(async()=>value(),id,url,{signal:new AbortController().signal});
    expect(result.previewImageUrl).toBe("blob:imported");expect(result.image).toBeInstanceOf(Blob);
    expect(revoke).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);if(result.previewImageUrl)URL.revokeObjectURL(result.previewImageUrl);
  });
  it("retains text and warns once when the optional image is unreadable",async()=>{
    vi.mocked(decodeWishImage).mockRejectedValue(new Error("unreadable"));
    const result=await loadWishImportSuggestions(async()=>value(),id,url,{signal:new AbortController().signal});
    expect(result).toMatchObject({name:"Produit",price:"19,99",image:null,previewImageUrl:null});expect(result.warnings).toHaveLength(1);expect(revoke).toHaveBeenCalledOnce();
  });
  it.each([false,true])("cleans up when the component cancels during retrieval or decoding: %s",async decoding=>{
    const gate=barrier(),controller=new AbortController();
    if(decoding)vi.mocked(decodeWishImage).mockImplementation(async()=>{await gate.promise;});
    const pending=loadWishImportSuggestions(async()=>{if(!decoding)await gate.promise;return value();},id,url,{signal:controller.signal});
    const rejected=expect(pending).rejects.toMatchObject({name:"AbortError"});
    await Promise.resolve();controller.abort();await rejected;
    expect(revoke).toHaveBeenCalledTimes(decoding?1:0);gate.resolve();await Promise.resolve();expect(vi.getTimerCount()).toBe(0);
  });
  it("does not start an already cancelled operation",async()=>{
    const controller=new AbortController();controller.abort();const preview=vi.fn(async()=>value());
    await expect(loadWishImportSuggestions(preview,id,url,{signal:controller.signal})).rejects.toMatchObject({name:"AbortError"});
    expect(preview).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  });
  it("retains an immediate provider error without leaving a deadline behind",async()=>{
    const error=new ApiError({kind:"network"});
    await expect(loadWishImportSuggestions(async()=>{throw error;},id,url,{signal:new AbortController().signal})).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });
});
