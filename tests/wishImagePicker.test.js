// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { disposeComponent } from "../src/components/index.js";
import { createWishImagePicker } from "../src/features/wishes/wishImagePicker.js";
import { decodeWishImage, validateWishImageFile, WishImageValidationError } from "../src/features/wishes/wishImageValidation.js";
import { barrier } from "./sessionTestHelpers.js";

vi.mock("../src/features/wishes/wishImageValidation.js",async original=>({...await original(),validateWishImageFile:vi.fn(async()=>"image/png"),decodeWishImage:vi.fn(async()=>{})}));
const {document,DataTransfer,File,Event}=globalThis;
async function settle(){for(let i=0;i<30;i++)await Promise.resolve();}
function setup(){
  const onBusy=vi.fn(),picker=createWishImagePicker({onBusy});document.body.append(picker.imagePanel,picker.messages);
  const input=/** @type {HTMLInputElement} */ (picker.imagePanel.querySelector('input[type="file"]'));
  const choose=()=>/** @type {HTMLButtonElement} */ (picker.imagePanel.querySelector('button[aria-label^="Ajouter"],button[aria-label^="Remplacer"]'));
  const remove=/** @type {HTMLButtonElement} */ (picker.imagePanel.querySelector('button[aria-label="Retirer la sélection"]'));
  function select(){const transfer=new DataTransfer();transfer.items.add(new File(["image"],"cadeau.png",{type:"image/png"}));input.files=transfer.files;input.dispatchEvent(new Event("change"));}
  return {...picker,input,choose,remove,onBusy,select};
}
afterEach(()=>{for(const child of [...document.body.children])disposeComponent(/** @type {HTMLElement} */ (child));document.body.replaceChildren();vi.restoreAllMocks();vi.clearAllMocks();});

describe("wishlist image selection",()=>{
  it("stays disabled until the draft can accept a selection",async()=>{
    const ui=setup();const click=vi.spyOn(ui.input,"click").mockImplementation(()=>{});
    expect(ui.choose().disabled).toBe(true);ui.select();await settle();expect(validateWishImageFile).not.toHaveBeenCalled();
    ui.update(false);ui.choose().click();expect(click).toHaveBeenCalledOnce();
  });
  it("validates, displays and removes the selected image, releasing its preview",async()=>{
    const create=vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:gift"),revoke=vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
    const ui=setup();ui.update(false);ui.select();await settle();
    expect(ui.getImage()).toBeInstanceOf(Blob);expect(ui.imagePanel.querySelector('img[src="blob:gift"]')).not.toBeNull();expect(ui.choose().getAttribute("aria-label")).toBe("Remplacer l’image");
    ui.remove.click();expect(ui.getImage()).toBeNull();expect(revoke).toHaveBeenCalledWith("blob:gift");expect(create).toHaveBeenCalledOnce();expect(ui.onBusy).toHaveBeenCalledTimes(2);
  });
  it("reports a rejected file without replacing the current selection",async()=>{
    vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:gift");vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
    const ui=setup();ui.update(false);ui.select();await settle();const image=ui.getImage();
    vi.mocked(validateWishImageFile).mockRejectedValueOnce(new WishImageValidationError("Image invalide."));ui.select();await settle();
    expect(ui.messages.textContent).toContain("Image invalide.");expect(ui.getImage()).toBe(image);expect(ui.isBusy()).toBe(false);
  });
  it("releases a preview that cannot be decoded",async()=>{
    vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:bad");const revoke=vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
    vi.mocked(decodeWishImage).mockRejectedValueOnce(new Error("bad image"));const ui=setup();ui.update(false);ui.select();await settle();
    expect(ui.messages.textContent).toContain("Cette image ne peut pas être lue.");expect(ui.getImage()).toBeNull();expect(revoke).toHaveBeenCalledWith("blob:bad");
  });
  it("releases an image decoded after the picker has been closed",async()=>{
    const gate=barrier();vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:pending");const revoke=vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
    vi.mocked(decodeWishImage).mockImplementationOnce(async()=>{await gate.promise;});const ui=setup();ui.update(false);ui.select();await settle();expect(ui.isBusy()).toBe(true);
    disposeComponent(ui.imagePanel);gate.resolve();await settle();expect(ui.getImage()).toBeNull();expect(revoke).toHaveBeenCalledWith("blob:pending");
  });
  it("does not create a preview if validation finishes after the picker closes",async()=>{
    const gate=barrier(),create=vi.spyOn(URL,"createObjectURL");
    vi.mocked(validateWishImageFile).mockImplementationOnce(async()=>{await gate.promise;return "image/png";});
    const ui=setup();ui.update(false);ui.select();await settle();disposeComponent(ui.imagePanel);gate.resolve();await settle();
    expect(create).not.toHaveBeenCalled();expect(decodeWishImage).not.toHaveBeenCalled();expect(ui.getImage()).toBeNull();
  });
  it("does not show an error when image decoding is cancelled",async()=>{
    vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:cancelled");const revoke=vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
    vi.mocked(decodeWishImage).mockRejectedValueOnce(new DOMException("cancelled","AbortError"));
    const ui=setup();ui.update(false);ui.select();await settle();
    expect(ui.messages.textContent).toBe("");expect(ui.getImage()).toBeNull();expect(revoke).toHaveBeenCalledWith("blob:cancelled");
  });
});
