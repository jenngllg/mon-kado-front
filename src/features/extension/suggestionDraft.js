import { validateWishField } from "../wishes/wishValidation.js";

/** @typedef {{name:string,price:string,url:string,image:Blob|null}} ProductDraft */
/** @type {{id:string,name:string,apply:(value:ProductDraft)=>boolean}|null} */
let current = null;

/** Registers only the currently open private editor; closing it revokes the destination.
 * @param {{label:string,apply:(value:ProductDraft)=>boolean}} options Local draft receiver.
 */
export function registerSuggestionDraft({label,apply}) {
  const draft={id:`suggestion:${crypto.randomUUID()}`,name:label,apply}; current=draft;
  return ()=>{if(current===draft)current=null;};
}

/** Returns no group or list identifiers to the extension. */
export function suggestionDraftDestination() { return current ? {id:current.id,name:current.name,isDraft:true} : null; }

/** Imports captured product details into the open form without saving a suggestion.
 * @param {Record<string,unknown>} value Extension payload.
 */
export function fillSuggestionDraft(value) {
  if (!current || value.listId!==current.id) return false;
  for (const key of /** @type {const} */ (["name","price","url"])) {
    if (typeof value[key]!=="string" || validateWishField(key,/** @type {string} */ (value[key]))!==null) return false;
  }
  if (!value.url || value.color || value.size) return false;
  let image=null;
  if (value.image) {
    if (typeof value.image!=="string" || value.image.length>2800000 || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.image)) return false;
    try {
      const bytes=Uint8Array.from(atob(value.image.split(",")[1]),char=>char.charCodeAt(0));
      if (bytes.length<12 || String.fromCharCode(...bytes.subarray(0,4))!=="RIFF" || String.fromCharCode(...bytes.subarray(8,12))!=="WEBP") return false;
      image=new Blob([bytes],{type:"image/webp"});
    } catch { return false; }
  }
  return current.apply({name:/** @type {string} */ (value.name),price:/** @type {string} */ (value.price),url:/** @type {string} */ (value.url),image});
}
