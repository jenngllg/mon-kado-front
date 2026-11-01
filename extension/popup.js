/* global chrome, browser, document */
import { extractProduct } from "./extract.js";
import { createImageSelection } from "./imageSelection.js";

const api = typeof browser !== "undefined" ? browser : chrome;
const status=document.querySelector("#status"), ownForm=document.querySelector("#form"), heading=document.querySelector("h1");
const modes=document.querySelector("#modes"), ownMode=document.querySelector("#own-mode"), suggestionMode=document.querySelector("#suggestion-mode");
let activeFlow=null;

/** A native selector for one destination, or a checkbox dropdown for personal lists. */
function createDestinationPicker(form,destinations,multiple,onChange){
  const select=form.querySelector("select");
  for(const item of destinations){const option=document.createElement("option");option.value=item.id;option.textContent=item.name;select.append(option);}
  if(!multiple||destinations.length<2)return {values:()=>select.value?[select.value]:[],first:()=>select.value||destinations[0]?.id,disable:value=>{select.disabled=value;}};
  const dropdown=document.createElement("details");dropdown.className="list-picker";
  const summary=document.createElement("summary"),choices=document.createElement("fieldset"),legend=document.createElement("legend");legend.textContent="Listes *";choices.append(legend);
  const inputs=[];
  function values(){return inputs.filter(input=>input.checked).map(input=>input.value);}
  function update(){const names=destinations.filter(item=>values().includes(item.id)).map(item=>item.name);summary.textContent=`Listes * : ${names.join(", ")||"Choisir…"}`;onChange();}
  for(const [index,item] of destinations.entries()){
    const label=document.createElement("label"),input=document.createElement("input");input.type="checkbox";input.value=item.id;input.checked=index===0;label.append(input,document.createTextNode(item.name));inputs.push(input);choices.append(label);input.addEventListener("change",update);
  }
  let disabled=false;
  summary.addEventListener("click",event=>{if(disabled)event.preventDefault();});
  dropdown.addEventListener("keydown",event=>{if(event.key==="Escape"&&dropdown.open){event.preventDefault();dropdown.open=false;summary.focus();}});
  document.addEventListener("click",event=>{if(!dropdown.contains(event.target))dropdown.open=false;});
  dropdown.append(summary,choices);select.closest("label").replaceWith(dropdown);
  update();
  return {values,first:()=>values()[0]||destinations[0]?.id,disable:value=>{disabled=value;summary.setAttribute("aria-disabled",String(value));inputs.forEach(input=>{input.disabled=value;});if(value)dropdown.open=false;}};
}

/** Each destination owns its draft, image selection and pending operation. */
function createFlow(form,destinations,product,siteTab,productTab,supportsVariants,supportsFavorites,draft){
  const name=form.querySelector('[data-field="name"]'),price=form.querySelector('[data-field="price"]'),color=form.querySelector('[data-field="color"]'),size=form.querySelector('[data-field="size"]'),favorite=form.querySelector('[data-field="favorite"]'),add=form.querySelector('[type="submit"]');
  let saving=false,completed=false,lastMessage="",initialized=false;
  const created=new Set(),imageFailures=new Set();
  let picker,images;
  function sync(){
    const frozen=saving||completed||created.size>0;
    for(const input of form.querySelectorAll("input,select,button"))input.disabled=frozen;
    picker?.disable(frozen);
    add.disabled=saving||completed||images?.isLoading()===true||!picker?.values().length;
    form.setAttribute("aria-busy",String(saving));
  }
  picker=createDestinationPicker(form,destinations,!draft,sync);
  images=createImageSelection(api,form.querySelector("[data-image-choices]").closest("fieldset"),sync,async url=>{
    const result=await api.tabs.sendMessage(siteTab,{action:"image",value:{listId:picker.first(),url}});return result?.image||"";
  });
  name.value=product.name;price.value=product.price;
  images.setSource(productTab,product.url);
  if(draft){form.querySelector(".variants").remove();form.querySelector(".favorite-control").remove();add.textContent="Préremplir l’idée";}
  function message(text){lastMessage=text;if(activeFlow===form)status.textContent=text;}
  function names(ids){return destinations.filter(item=>ids.includes(item.id)).map(item=>`« ${item.name} »`).join(", ");}
  function confirmation(ids){return ids.length===1?`Souhait ajouté à la liste ${names(ids)}.`:`Souhait ajouté aux listes ${names(ids)}.`;}
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(saving||completed||images.isLoading()||!picker.values().length)return;
    if(!name.value.trim()||!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(price.value.trim())&&price.value.trim()!==""){message("Vérifie le nom et le prix.");return;}
    if(!draft&&(color.value.trim()||size.value.trim())&&!supportsVariants){message("Actualise l’onglet MonKado pour enregistrer la couleur et la taille, puis rouvre l’extension.");return;}
    if(!draft&&favorite.checked&&!supportsFavorites){message("Actualise l’onglet MonKado pour enregistrer le coup de cœur, puis rouvre l’extension.");return;}
    const selected=picker.values(),pending=selected.filter(id=>!created.has(id));
    const value={name:name.value,price:price.value,color:draft?"":color.value,size:draft?"":size.value,url:product.url,image:images.getImage(),...(!draft?{isFavorite:favorite.checked}:{})};
    saving=true;sync();message(draft?"Transmission au formulaire privé…":"Ajout en cours…");ownMode.disabled=suggestionMode.disabled=true;
    const rejected=[];
    try{
      for(const listId of pending){
        const result=await api.tabs.sendMessage(siteTab,{action:"create",value:{listId,...value}});
        if(result?.success&&(!draft||result.draft)||!draft&&result?.error==="image"){
          created.add(listId);if(result.error==="image")imageFailures.add(listId);continue;
        }
        if(["rejected","invalid","login"].includes(result?.error)){rejected.push(listId);continue;}
        completed=true;
        message(draft?"La transmission n’a pas pu être confirmée. Vérifie le formulaire dans MonKado.":`${created.size?confirmation([...created])+" ":""}L’ajout à ${names([listId])} n’a pas pu être confirmé. Consulte tes listes avant de réessayer.`);return;
      }
      if(rejected.length){
        message(draft?"Le formulaire privé n’est plus disponible. Ouvre la proposition dans MonKado, puis rouvre l’extension.":`${created.size?confirmation([...created])+" ":""}Ajout refusé dans ${names(rejected)}. Vérifie les informations et ta connexion MonKado.`);
        if(created.size)add.textContent="Réessayer les listes restantes";return;
      }
      completed=true;message(draft?"Informations transmises au formulaire privé. Retourne dans MonKado pour vérifier et proposer l’idée.":confirmation(selected)+(imageFailures.size?(selected.length===1?" Son image n’a pas pu être enregistrée.":` Image non enregistrée dans ${names([...imageFailures])}.`):""));form.hidden=true;
    }catch{completed=true;message(draft?"La transmission n’a pas pu être confirmée. Vérifie le formulaire dans MonKado.":`${created.size?confirmation([...created])+" ":""}L’ajout n’a pas pu être confirmé. Consulte tes listes avant de réessayer.`);}
    finally{saving=false;sync();ownMode.disabled=suggestionMode.disabled=false;}
  });
  return {show(){activeFlow=form;form.hidden=completed;heading.textContent=draft?"Proposer une idée surprise":"Ajouter un souhait";status.textContent=lastMessage||(!product.price||!product.name?"Vérifie et complète les informations du produit.":"");if(!initialized){initialized=true;images.setImages(product.images||[]);}sync();}};
}

async function initialize(){
  try{
    const [tab]=await api.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!tab.url||!/^https?:\/\//i.test(tab.url))throw new Error("page");
    const [capture]=await api.scripting.executeScript({target:{tabId:tab.id},func:extractProduct});
    const product=capture?.result;if(!product?.url)throw new Error("page");
    const candidates=await api.tabs.query({url:["https://www.monkado.fr/*"]});let selected=null,updateRequired=false;
    for(const candidate of candidates){
      if(!candidate.id)continue;
      try{
        const probe=await api.tabs.sendMessage(candidate.id,{action:"probe"});if(!probe?.ready){updateRequired=true;continue;}
        const response=await api.tabs.sendMessage(candidate.id,{action:"lists"});if(!Array.isArray(response?.lists))continue;
        const context={id:candidate.id,lists:response.lists,supportsVariants:probe.supportsVariants===true,supportsFavorites:probe.supportsFavorites===true};
        if(!selected)selected=context;
        if(response.lists.some(item=>item.isDraft)){selected=context;break;}
      }catch{/* A tab may need to be reloaded after extension installation. */}
    }
    if(!selected){status.textContent=updateRequired?"Le site MonKado doit être mis à jour avant d’utiliser l’extension.":"Connecte-toi sur le site MonKado, actualise l’onglet, puis rouvre l’extension.";return;}
    const personal=selected.lists.filter(item=>!item.isDraft),drafts=selected.lists.filter(item=>item.isDraft);
    if(!personal.length&&!drafts.length){status.textContent="Aucune liste disponible dans MonKado.";return;}
    const proposal=ownForm.cloneNode(true);proposal.id="suggestion-form";proposal.hidden=true;
    for(const control of proposal.querySelectorAll("[id]"))control.id=`suggestion-${control.id}`;
    proposal.querySelector("label").firstChild.textContent="Brouillon privé *";
    const privacy=document.createElement("p");privacy.textContent="Visible uniquement par les membres du groupe, sauf le destinataire. Vérifie puis confirme la proposition dans MonKado.";proposal.prepend(privacy);ownForm.after(proposal);
    const own=createFlow(ownForm,personal,product,selected.id,tab.id,selected.supportsVariants,selected.supportsFavorites,false);
    const suggestion=createFlow(proposal,drafts,product,selected.id,tab.id,selected.supportsVariants,selected.supportsFavorites,true);
    function show(draft){
      ownForm.remove();proposal.remove();ownMode.setAttribute("aria-pressed",String(!draft));suggestionMode.setAttribute("aria-pressed",String(draft));
      if(draft&&!drafts.length){activeFlow=null;heading.textContent="Proposer une idée surprise";status.textContent="Ouvre une liste dans un groupe et clique sur « Proposer une idée », puis rouvre l’extension.";return;}
      if(!draft&&!personal.length){activeFlow=null;heading.textContent="Ajouter un souhait";status.textContent="Aucune liste personnelle disponible.";return;}
      status.after(draft?proposal:ownForm);(draft?suggestion:own).show();
    }
    ownMode.addEventListener("click",()=>show(false));suggestionMode.addEventListener("click",()=>show(true));modes.hidden=false;show(!personal.length&&drafts.length>0);
  }catch{status.textContent="Cette page ne peut pas être lue. Ouvre une page produit et réessaie.";}
}
void initialize();
