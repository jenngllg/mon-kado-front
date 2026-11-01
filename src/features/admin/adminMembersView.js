import { ApiError, isAbortError } from "../../api/apiError.js";
import { createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAdminMembersService } from "./adminMembersService.js";

/** Account administration bound to the actual session; API authorization is checked on every request.
 * @param {import("../../auth/sessionManager.js").SessionManager} session Session owner.
 * @param {AbortSignal} signal Route lifetime.
 */
export function createAdminMembersView(session,signal) {
  const service=createAdminMembersService(session), lifetime=new AbortController();
  const view=node("section","");view.className="reported-wishlists-view flow";
  const title=node("h1","Comptes");
  const form=node("form","");form.className="reported-wishlists-filters cluster";
  const search=node("input","");search.type="search";search.maxLength=100;
  form.append(createFormField({label:"Pseudo ou tag",control:search}),createButton({label:"Rechercher",type:"submit"}));
  const notice=node("p","");notice.setAttribute("role","status");
  const results=node("div","");results.className="flow";
  view.append(title,form,notice,results);
  let page=1, query="", disposed=false;
  /** @type {AbortController|null} */ let pending=null;
  /** @type {HTMLDialogElement|null} */ let dialog=null;
  registerComponentCleanup(view,()=>{disposed=true;lifetime.abort();pending?.abort();closeDialog();clear(results);notice.textContent="";});
  addComponentEventListener(view,signal,"abort",()=>disposeComponent(view),{once:true});
  addComponentEventListener(view,form,"submit",event=>{event.preventDefault();page=1;query=search.value.trim();void read();});
  if(signal.aborted)disposeComponent(view);else void read();
  return view;

  function closeDialog(){if(dialog){disposeComponent(dialog);dialog.remove();dialog=null;}}
  async function read(){
    pending?.abort();const operation=new AbortController();pending=operation;clear(results);results.append(createLoadingState({label:"Chargement des comptes…"}));
    try {
      const data=await service.load({page,q:query,signal:operation.signal});
      if(disposed||operation.signal.aborted)return;
      clear(results);
      if(!data.items.length)results.append(node("p","Aucun compte trouvé."));
      for(const item of data.items){
        const row=node("article","");row.className="reported-wishlist flow";
        const header=node("div","");header.className="section-toolbar";header.append(node("h2",handle(item)));
        if(item.id!==session.getSnapshot().user?.id){
          const erase=createButton({label:"Supprimer",variant:"danger",onClick:()=>open(item)});
          erase.setAttribute("aria-label",`Supprimer le compte de ${handle(item)}`);header.append(erase);
        }else header.append(node("p","Ton compte"));
        row.append(header);
        results.append(row);
      }
      if(data.hasPreviousPage||data.hasNextPage){
        const navigation=node("div","");navigation.className="cluster";
        navigation.append(createButton({label:"Précédent",variant:"secondary",disabled:!data.hasPreviousPage,onClick:()=>{page--;void read();}}),createButton({label:"Suivant",variant:"secondary",disabled:!data.hasNextPage,onClick:()=>{page++;void read();}}));results.append(navigation);
      }
    }catch(error){if(disposed||operation.signal.aborted)return;clear(results);results.append(alert(accessError(error)?"Accès administrateur refusé. Reconnecte-toi et vérifie la double authentification.":"Impossible de charger les comptes."));if(!accessError(error))results.append(createButton({label:"Réessayer",variant:"secondary",onClick:()=>{void read();}}));}
  }
  /** @param {import("./adminMembersService.js").AdminMember} selected Target selected from authorized results. */
  function open(selected){
    closeDialog();const modal=node("dialog","");dialog=modal;modal.className="wishlist-report-dialog flow";
    const heading=node("h2",`Supprimer le compte de ${handle(selected)} ?`);heading.id=`erase-${crypto.randomUUID()}`;heading.tabIndex=-1;heading.setAttribute("autofocus","");modal.setAttribute("aria-labelledby",heading.id);
    const warning=node("p","Cette action est définitive : le compte et ses données seront supprimés. Un courriel de confirmation sera envoyé si son adresse est confirmée.");warning.id=`${heading.id}-warning`;modal.setAttribute("aria-describedby",warning.id);
    const feedback=node("div","");
    const editor=node("form","");editor.className="flow";
    const reference=node("input","");reference.required=true;reference.maxLength=100;
    const confirmation=node("input","");confirmation.required=true;confirmation.autocomplete="off";
    const actions=node("div","");actions.className="cluster";
    let busy=false,writing=false,ready=false,uncertain=false;
    const controller=new AbortController();
    const cancel=createButton({label:"Annuler",variant:"secondary",onClick:()=>{if(!writing)modal.close();}});
    const submit=createButton({label:"Supprimer définitivement",variant:"danger",type:"submit",disabled:true});
    const verify=createButton({label:"Vérifier la suppression",variant:"secondary",onClick:()=>{void load(true);}});verify.hidden=true;
    editor.append(createFormField({label:"Référence de la demande",control:reference,required:true}),createFormField({label:`Recopie « ${handle(selected)} »`,control:confirmation,required:true}),actions);actions.append(cancel,submit,verify);modal.append(heading,warning,feedback,editor);view.append(modal);
    registerComponentCleanup(modal,()=>controller.abort());
    addComponentEventListener(modal,modal,"close",()=>{closeDialog();});
    addComponentEventListener(modal,modal,"cancel",event=>{if(writing)event.preventDefault();});
    addComponentEventListener(modal,editor,"input",sync);
    addComponentEventListener(modal,editor,"submit",event=>{event.preventDefault();void erase();});
    modal.showModal();void load(false);
    function sync(){submit.disabled=busy||!ready||uncertain||confirmation.value!==handle(selected)||!reference.value.trim();cancel.disabled=writing;verify.disabled=busy;reference.disabled=busy;confirmation.disabled=busy;}
    /** @param {boolean} check Whether checking an uncertain mutation. */
    async function load(check){
      busy=true;sync();feedback.replaceChildren(createLoadingState({label:"Vérification du compte…"}));
      try{
        const current=await service.loadOne(selected.id,controller.signal);if(controller.signal.aborted)return;
        ready=handle(current)===handle(selected);
        feedback.replaceChildren();
        if(!ready)feedback.append(alert("Le pseudo a changé. Ferme cette fenêtre et actualise les comptes."));
        else if(check){uncertain=false;verify.hidden=true;feedback.append(alert("Le compte existe encore. Vérifie la demande avant de confirmer à nouveau."));}
      }catch(error){
        if(controller.signal.aborted)return;
        ready=false;
        if(accessError(error)){closeDialog();clear(results);results.append(alert("Accès administrateur refusé. Reconnecte-toi avec la double authentification."));return;}
        if(error instanceof ApiError&&error.statusCode===404){if(check){done("Suppression vérifiée. Le compte n’existe plus.");return;}feedback.replaceChildren(alert("Ce compte n’existe plus."));}
        else feedback.replaceChildren(alert(accessError(error)?"Accès refusé. Reconnecte-toi avec la double authentification.":"Impossible de vérifier ce compte."));
      }finally{busy=false;sync();}
    }
    async function erase(){
      if(submit.disabled)return;busy=true;writing=true;sync();feedback.replaceChildren();
      try{await service.erase(selected.id,reference.value.trim(),controller.signal);if(!controller.signal.aborted)done("Compte supprimé. La notification est prise en charge par le service d’envoi.");}
      catch(error){
        if(controller.signal.aborted||isAbortError(error))return;
        if(accessError(error)){closeDialog();clear(results);results.append(alert("Accès administrateur refusé. Reconnecte-toi avec la double authentification."));return;}
        uncertain=!(error instanceof ApiError)||error.kind!=="http"||error.statusCode===null||error.statusCode>=500;
        ready=false;
        if(uncertain){verify.hidden=false;feedback.replaceChildren(alert("Résultat incertain. Vérifie la suppression avant toute nouvelle tentative."));}
        else feedback.replaceChildren(alert(accessError(error)?"Accès refusé. Reconnecte-toi avec la double authentification.":"Suppression refusée. Ferme cette fenêtre et actualise les comptes."));
      }finally{busy=false;writing=false;sync();}
    }
    /** @param {string} message Confirmed result. */
    function done(message){notice.textContent=message;closeDialog();void read();notice.tabIndex=-1;notice.focus();}
  }
}
/** @param {import("./adminMembersService.js").AdminMember} member Identity. */
function handle(member){return `${member.displayName} #${member.displayNameTag}`;}
/** @param {unknown} error Failure. */
function accessError(error){return error instanceof ApiError&&(error.statusCode===401||error.statusCode===403);}
/** @param {string} text Accessible feedback. */
function alert(text){const result=node("p",text);result.setAttribute("role","alert");return result;}
/** @param {HTMLElement} host Disposable children. */
function clear(host){for(const child of host.children)disposeComponent(/** @type {HTMLElement} */(child));host.replaceChildren();}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Text. @returns {HTMLElementTagNameMap[T]} */
function node(tag,text){const result=document.createElement(tag);result.textContent=text;return result;}
