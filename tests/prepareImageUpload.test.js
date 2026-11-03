// @vitest-environment happy-dom
/* global document, HTMLImageElement, HTMLCanvasElement */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareImageUpload, prepareWishImageUpload } from "../src/features/wishes/prepareImageUpload.js";

const signature = [137,80,78,71,13,10,26,10];
const signal = new AbortController().signal;
const prepared = new Blob([new Uint8Array(signature)], {type:"image/png"});
const source = () => new Blob([new Uint8Array(signature), new Uint8Array(400_000)], {type:"image/png"});
let load = true;
/** @type {HTMLImageElement | undefined} */ let image;
beforeEach(() => {
  load = true;
  vi.stubGlobal("Image", function () {
    image = document.createElement("img");
    const selected = image;
    queueMicrotask(() => { if (load) selected.dispatchEvent(new Event("load")); });
    return selected;
  });
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:local-preparation"); static revokeObjectURL = vi.fn(); });
  vi.spyOn(HTMLImageElement.prototype,"naturalWidth","get").mockReturnValue(4000);
  vi.spyOn(HTMLImageElement.prototype,"naturalHeight","get").mockReturnValue(3000);
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(/** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({drawImage:vi.fn()})));
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(callback => callback(prepared));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("local image preparation", () => {
  it("adapts complex wish images to the measured byte target in at most two encodes", async () => {
    /** @type {{width:number,height:number,quality:number|undefined}[]} */ const attempts=[];
    const compact=new Blob([new Uint8Array(170_000)],{type:"image/webp"});
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(/** @this {HTMLCanvasElement} */ function(callback,_type,quality){
      attempts.push({width:this.width,height:this.height,quality:/** @type {number} */(quality)});
      callback(attempts.length===1?new Blob([new Uint8Array(680_000)],{type:"image/webp"}):compact);
    });
    const result=await prepareWishImageUpload(source(),{signal});
    expect(result).toBe(compact);
    expect(attempts).toEqual([{width:1600,height:1200,quality:.82},{width:1024,height:768,quality:.82}]);
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it("keeps the largest dimensions when the first wish encoding already meets the target",async()=>{
    const result=await prepareWishImageUpload(source(),{signal});
    expect(result).toBe(prepared);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledOnce();
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function),"image/webp",.82);
  });
  it("reuses preparation after selection without encoding the same immutable source again",async()=>{
    const file=source();
    const selected=await prepareWishImageUpload(file,{signal});
    const uploaded=await prepareWishImageUpload(file,{signal:new AbortController().signal});
    expect(uploaded).toBe(selected);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledOnce();
    await expect(prepareWishImageUpload(file,{signal:AbortSignal.abort()})).rejects.toMatchObject({name:"AbortError"});
  });
  it("prepares files above the wish target even when below the general preparation threshold",async()=>{
    const file=new Blob([new Uint8Array(signature),new Uint8Array(220_000)],{type:"image/png"});
    expect(await prepareWishImageUpload(file,{signal})).toBe(prepared);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledOnce();
  });
  it("does not repeatedly encode a source that is already at the minimum useful dimensions",async()=>{
    vi.spyOn(HTMLImageElement.prototype,"naturalWidth","get").mockReturnValue(800);
    vi.spyOn(HTMLImageElement.prototype,"naturalHeight","get").mockReturnValue(600);
    const output=new Blob([new Uint8Array(250_000)],{type:"image/png"});
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(callback=>callback(output));
    expect(await prepareWishImageUpload(source(),{signal})).toBe(output);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledOnce();
  });
  it("preserves the smaller source when a fallback encoder would increase the upload size",async()=>{
    vi.spyOn(HTMLImageElement.prototype,"naturalWidth","get").mockReturnValue(800);
    vi.spyOn(HTMLImageElement.prototype,"naturalHeight","get").mockReturnValue(600);
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(callback=>callback(new Blob([new Uint8Array(600_000)],{type:"image/png"})));
    const file=source();
    expect(await prepareWishImageUpload(file,{signal})).toBe(file);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledOnce();
  });
  it("releases canvas pixels and does not cache a cancelled encoding",async()=>{
    const controller=new AbortController();
    /** @type {BlobCallback|undefined} */ let finish;
    /** @type {HTMLCanvasElement|undefined} */ let canvas;
    /** @type {()=>void} */ let started;
    const encoding = new Promise(resolve=>{started=()=>resolve(undefined);});
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(/** @this {HTMLCanvasElement} */ function(callback){finish=callback;canvas=this;started();});
    const file=source(),request=prepareWishImageUpload(file,{signal:controller.signal});
    const rejected=expect(request).rejects.toMatchObject({name:"AbortError"});
    await encoding;controller.abort();finish?.(prepared);await rejected;
    expect(canvas?.width).toBe(0);expect(canvas?.height).toBe(0);
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(callback=>callback(prepared));
    expect(await prepareWishImageUpload(file,{signal})).toBe(prepared);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledTimes(2);
  });
  it("keeps small files unchanged without allocating a decoder", async () => {
    const result=await prepareImageUpload(prepared,{maximumEdge:1600,signal});
    expect(result).toBe(prepared);expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it.each([1600,512])("bounds large images to %s pixels and releases pixels and object URLs", async maximumEdge => {
    /** @type {number[][]} */ const dimensions=[];
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(/** @this {HTMLCanvasElement} */ function (callback) {dimensions.push([this.width,this.height]);callback(prepared);});
    const result=await prepareImageUpload(source(),{maximumEdge,signal});
    expect(result).toBe(prepared);expect(dimensions).toEqual([[maximumEdge,maximumEdge*3/4]]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preparation");expect(image?.hasAttribute("src")).toBe(false);
  });
  it("cancels before preparation without accessing the file", async () => {
    await expect(prepareImageUpload(source(),{maximumEdge:1600,signal:AbortSignal.abort()})).rejects.toMatchObject({name:"AbortError"});
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("cancels a pending decode and revokes its object URL", async () => {
    load=false;const controller=new AbortController();
    /** @type {() => void} */ let started;
    const decoding = new Promise(resolve => { started = () => resolve(undefined); });
    vi.mocked(URL.createObjectURL).mockImplementation(()=>{started();return "blob:local-preparation";});
    const request=prepareImageUpload(source(),{maximumEdge:1600,signal:controller.signal});
    const rejected=expect(request).rejects.toMatchObject({name:"AbortError"});
    await decoding;
    controller.abort();await rejected;expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it("rejects excessive pixels before drawing", async () => {
    vi.spyOn(HTMLImageElement.prototype,"naturalWidth","get").mockReturnValue(20000);
    await expect(prepareImageUpload(source(),{maximumEdge:1600,signal})).rejects.toThrow("40 millions");
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it.each(["acTL","ANIM"])("rejects animated %s sources before flattening", async tag => {
    const png=tag==="acTL";
    const bytes=png ? [...signature,0,0,0,0,...new TextEncoder().encode(tag),0,0,0,0] : [82,73,70,70,4,0,0,0,87,69,66,80,...new TextEncoder().encode(tag),0,0,0,0];
    await expect(prepareImageUpload(new Blob([new Uint8Array(bytes)]),{maximumEdge:1600,signal})).rejects.toThrow("animées");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
