// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from "vitest";
import {registerSuggestionDraft,suggestionDraftDestination,fillSuggestionDraft} from "../src/features/extension/suggestionDraft.js";
/** @type {(()=>void)[]} */const cleanups=[];
afterEach(()=>{cleanups.splice(0).forEach(stop=>stop());});
function setup(){const apply=vi.fn((/** @type {import("../src/features/extension/suggestionDraft.js").ProductDraft} */ value)=>!!value);cleanups.push(registerSuggestionDraft({label:"Idée surprise pour Léa",apply}));return apply;}
it("offers only an ephemeral destination and revokes it when its editor closes",()=>{
  const apply=setup(),target=suggestionDraftDestination();expect(target).toMatchObject({name:"Idée surprise pour Léa",isDraft:true});expect(target?.id).toMatch(/^suggestion:/);
  expect(fillSuggestionDraft({listId:target?.id,name:"Livre",price:"12,50",url:"https://shop.example/product"})).toBe(true);
  expect(apply).toHaveBeenCalledExactlyOnceWith({name:"Livre",price:"12,50",url:"https://shop.example/product",image:null});
  cleanups[0]();expect(suggestionDraftDestination()).toBeNull();expect(fillSuggestionDraft({listId:target?.id})).toBe(false);
});
it("does not apply an old destination to a newly opened editor",()=>{
  const old=setup(),target=suggestionDraftDestination(),fresh=setup();cleanups[0]();
  expect(suggestionDraftDestination()).not.toBeNull();expect(fillSuggestionDraft({listId:target?.id,name:"Livre",price:"",url:"https://shop.example/product"})).toBe(false);
  expect(old).not.toHaveBeenCalled();expect(fresh).not.toHaveBeenCalled();
});
it.each([{name:""},{name:123},{price:"-1"},{url:"javascript:alert(1)"},{url:""},{color:"bleu"},{image:"https://shop.example/photo"},{image:"data:image/webp;base64,QUJD"},{image:"data:image/webp;base64,AA=="}])("rejects malformed product data before touching the draft: %j",extra=>{
  const apply=setup();expect(fillSuggestionDraft({listId:suggestionDraftDestination()?.id,name:"Livre",price:"12",url:"https://shop.example/product",...extra})).toBe(false);expect(apply).not.toHaveBeenCalled();
});
it("accepts a bounded WebP payload for local validation in the form",()=>{
  const apply=setup();const image="data:image/webp;base64,"+btoa("RIFF0000WEBP0000");
  expect(fillSuggestionDraft({listId:suggestionDraftDestination()?.id,name:"Livre",price:"",url:"https://shop.example/product",image})).toBe(true);expect(apply.mock.calls[0]?.[0].image).toBeInstanceOf(Blob);
});
