import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { createImagePlaceholder } from "../../components/imagePlaceholder.js";
import { safeHttpUrl, validateWishField } from "../wishes/wishValidation.js";
import { decodeWishImage, validateWishImageFile, WishImageValidationError } from "../wishes/wishImageValidation.js";
import { createWishForm } from "../wishes/wishForm.js";
import { registerSuggestionDraft } from "../extension/suggestionDraft.js";

/** @typedef {import("./groupSuggestionsService.js").Suggestion} Suggestion */
/** @typedef {ReturnType<typeof import("./groupSuggestionsService.js").createGroupSuggestionsService>} SuggestionService */

/** Displays and manages ideas in the exact group, excluding the list owner.
 * @param {{service:SuggestionService,ownerName:string,signal:AbortSignal}} options Scoped dependencies.
 * @returns {HTMLElement} Disposable section.
 */
export function createGroupSuggestionsView({ service, ownerName, signal }) {
  const root = document.createElement("section"); root.className = "group-suggestions flow";
  const header = document.createElement("div"); header.className = "section-toolbar";
  const title = document.createElement("h2"); title.textContent = "Idées surprises proposées";
  const add = createButton({label:"Proposer une idée", onClick: () => openEditor(null)});
  header.append(title, add);
  const explanation = document.createElement("p"); explanation.textContent = `Visibles par les membres de ce groupe, sauf ${ownerName}.`;
  const feedback = document.createElement("p"); feedback.setAttribute("role", "status");
  const items = document.createElement("div"); items.className = "group-suggestions__items";
  root.append(header, explanation, feedback, items);
  const lifetime = new AbortController();
  /** @type {Set<string>} */ const objectURLs = new Set();
  /** @type {HTMLDialogElement | null} */ let dialog = null;
  let disposed = false, generation = 0, reading = false;
  addComponentEventListener(root, signal, "abort", () => disposeComponent(root), {once:true});
  registerComponentCleanup(root, () => { disposed = true; generation++; lifetime.abort(); closeDialog(); releaseImages(); items.replaceChildren(); });
  if (signal.aborted) disposeComponent(root); else void refresh();
  return root;

  function releaseImages() { for (const url of objectURLs) URL.revokeObjectURL(url); objectURLs.clear(); }
  function closeDialog() { if (dialog) { const current = dialog; dialog = null; disposeComponent(current); } }
  async function refresh() {
    if (disposed || reading) return;
    reading = true; const current = ++generation; releaseImages(); items.replaceChildren();
    feedback.textContent = "Chargement des idées…"; add.disabled = true;
    try {
      const suggestions = await service.list(lifetime.signal);
      if (disposed || current !== generation) return;
      feedback.textContent = ""; add.disabled = false;
      if (!suggestions.length) { const empty = document.createElement("p"); empty.textContent = "Aucune idée proposée pour le moment."; items.append(empty); return; }
      const list = document.createElement("ul"); list.className = "group-suggestions__grid"; list.setAttribute("role", "list");
      /** @type {{item:Suggestion,host:HTMLElement}[]} */ const pendingImages = [];
      for (const item of suggestions) {
        const card = document.createElement("li"); card.className = "group-suggestions__card"; card.id = `suggestion-${item.id}`;
        const media = document.createElement("div"); media.className = "group-suggestions__media"; media.append(createImagePlaceholder("Sans image"));
        if (item.hasImage) pendingImages.push({item,host:media});
        const content = document.createElement("div"); content.className = "group-suggestions__content flow";
        const name = document.createElement("h3"); name.textContent = item.name;
        const author = document.createElement("p"); author.className = "group-suggestions__author"; author.textContent = `Idée proposée par ${item.authorDisplayName ?? "un membre supprimé"}`;
        content.append(name, author);
        if (item.note) { const note = document.createElement("p"); note.textContent = item.note; content.append(note); }
        const product = item.url ? safeHttpUrl(item.url) : null;
        if (product) { const link = document.createElement("a"); link.href = product.href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Voir le produit"; content.append(link); }
        if (item.price !== null) { const price = document.createElement("p"); price.textContent = new Intl.NumberFormat("fr-FR", {style:"currency",currency:"EUR"}).format(item.price); content.append(price); }
        const quantity = document.createElement("p"); quantity.textContent = item.reservedQuantity ? `${item.reservedQuantity} sur ${item.quantity} réservé${item.reservedQuantity > 1 ? "s" : ""}` : `${item.quantity} disponible${item.quantity > 1 ? "s" : ""}`;
        content.append(quantity);
        if (item.currentParticipantReservedQuantity) { const mine = document.createElement("p"); mine.textContent = `Tu as réservé ${item.currentParticipantReservedQuantity} exemplaire${item.currentParticipantReservedQuantity > 1 ? "s" : ""}.`; content.append(mine); }
        const actions = document.createElement("div"); actions.className = "cluster";
        if (item.currentParticipantReservedQuantity || item.reservedQuantity < item.quantity) actions.append(createButton({label:item.currentParticipantReservedQuantity ? "Ma réservation" : "Réserver", onClick: () => openReservation(item)}));
        if (item.canEdit) {
          const edit = createButton({label:"Modifier",variant:"secondary",onClick:() => openEditor(item)});
          const remove = createButton({label:"Supprimer",variant:"secondary",onClick:() => openDelete(item)});
          edit.disabled = remove.disabled = item.reservedQuantity > 0;
          if (item.reservedQuantity > 0) { edit.title = remove.title = "Une idée réservée ne peut pas être modifiée ou supprimée."; }
          actions.append(edit, remove);
          if (item.reservedQuantity > 0) { const notice = document.createElement("p"); notice.textContent = "Cette idée ne peut pas être modifiée ou supprimée tant qu’elle est réservée."; content.append(notice); }
        }
        content.append(actions); card.append(media, content); list.append(card);
      }
      items.append(list);
      // At most three authenticated image requests may be active at once.
      let next = 0;
      async function loadImages() {
        while (!disposed && current === generation && next < pendingImages.length) {
          const entry = pendingImages[next++];
          try {
            const blob = await service.image(entry.item.id, lifetime.signal);
            if (disposed || current !== generation) return;
            const objectURL = URL.createObjectURL(blob); objectURLs.add(objectURL);
            const image = document.createElement("img"); image.src = objectURL; image.alt = ""; image.loading = "lazy";
            entry.host.replaceChildren(image);
          } catch (error) { if (disposed || current !== generation || isAbortError(error)) return; entry.host.replaceChildren(createImagePlaceholder("Image indisponible")); }
        }
      }
      for (let index = 0; index < Math.min(3, pendingImages.length); index++) void loadImages();
      if (location.hash.startsWith("#suggestion-")) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      feedback.textContent = error instanceof ApiError && error.statusCode === 404 && ["GROUP_NOT_FOUND", "GROUP_WISHLIST_NOT_FOUND", "GROUP_SUGGESTION_NOT_FOUND"].includes(error.errorCode ?? "") ? "Ces idées ne sont plus accessibles dans ce groupe." : "Impossible de charger les idées. Réessaie.";
      items.append(createButton({label:"Réessayer",variant:"secondary",onClick:() => { void refresh(); }}));
    } finally { reading = false; }
  }

  /** @param {string} heading Dialog title. */
  function openDialog(heading) {
    if (disposed || dialog) return null;
    const modal = document.createElement("dialog"); modal.className = "wishlist-report-dialog group-suggestions__dialog flow";
    const label = document.createElement("h2"); label.textContent = heading; label.id = `suggestion-dialog-${crypto.randomUUID()}`; label.tabIndex = -1;
    modal.setAttribute("aria-labelledby",label.id); modal.append(label);
    let busy = false;
    const close = () => { if (!busy) { closeDialog(); add.focus(); } };
    addComponentEventListener(modal, modal, "cancel", event => { event.preventDefault(); close(); });
    registerComponentCleanup(modal, () => { if (modal.open) modal.close(); modal.remove(); });
    dialog = modal; root.append(modal); modal.showModal(); label.focus();
    return {modal,close,setBusy: (/** @type {boolean} */ value) => {busy=value; modal.setAttribute("aria-busy",String(value));}};
  }

  /** @param {unknown} error Failure. */
  function errorText(error) {
    if (error instanceof ApiError && error.errorCode === "GROUP_SUGGESTION_RESERVED") return "Cette idée est réservée : elle ne peut pas être modifiée ou supprimée.";
    if (error instanceof ApiError && error.statusCode === 412) return "Cette idée a changé. Actualise-la avant de recommencer.";
    if (error instanceof ApiError && error.statusCode === 409) return "Cette réservation ou cette idée a changé. Actualise la liste avant de recommencer.";
    return "L’opération n’a pas pu être confirmée. Actualise les idées pour vérifier le résultat.";
  }
  /** @param {{modal:HTMLDialogElement,close:()=>void}} shell Dialog. @param {HTMLElement} host Feedback. @param {unknown} error Failure. */
  function failed(shell, host, error, prefix = "") {
    if (disposed || isAbortError(error)) return;
    host.textContent = prefix + errorText(error);
    const verify = createButton({label:"Actualiser les idées",variant:"secondary",onClick:() => { shell.close(); void refresh(); }});
    host.append(document.createTextNode(" "),verify);
  }
  function completed() { closeDialog(); add.focus(); void refresh(); }

  /** @param {Suggestion | null} item Existing idea or creation. */
  function openEditor(item) {
    const shell = openDialog(item ? "Modifier l’idée" : "Proposer une idée surprise"); if (!shell) return;
    const info = document.createElement("p"); info.textContent = `Cette idée sera visible par les membres de ce groupe, sauf ${ownerName}.`;
    let saving = false;
    const shared = createWishForm({inactive:()=>disposed || saving,onChange:()=>{},label:item ? "Modifier l’idée" : "Proposer une idée surprise"});
    const {form} = shared;
    const fields = shared.fields.filter(field=>!["color","size"].includes(field.name));
    for (const field of shared.fields) {
      if (!fields.includes(field)) field.element.remove();
      else if (item) field.control.value=String(item[/** @type {keyof Suggestion} */ (field.name)] ?? "");
    }
    form.querySelector(".wish-form__variants")?.remove();
    shared.surpriseLabel.remove(); shared.secondHandLabel.remove(); shared.favorite.closest("label")?.remove();
    const link = fields.find(field=>field.name==="url"); if (link) form.prepend(link.element);
    shared.syncQuantityControls();
    const file = document.createElement("input"); file.type="file"; file.accept="image/jpeg,image/png,image/webp"; file.name="image"; file.hidden=true; file.setAttribute("aria-label","Image");
    const fileField = document.createElement("div"); fileField.className="form-field";
    const fileLabel = document.createElement("span"); fileLabel.className="form-field__label"; fileLabel.textContent="Image";
    const choose = createButton({label:item?.hasImage ? "Remplacer l’image" : "Choisir une image",variant:"secondary",onClick:()=>file.click()});
    const filename = document.createElement("span"); filename.setAttribute("aria-live","polite");
    addComponentEventListener(form,file,"change",()=>{filename.textContent=file.files?.[0]?.name ?? "";});
    fileField.append(fileLabel,choose,filename,file); form.append(fileField);
    const removeImage = document.createElement("input"); removeImage.type="checkbox";
    if (item?.hasImage) { const label = document.createElement("label"); label.append(removeImage, document.createTextNode(" Retirer l’image existante")); form.append(label); }
    const status = document.createElement("p"); status.setAttribute("role","alert");
    const actions = document.createElement("div"); actions.className="cluster";
    const cancel = createButton({label:"Annuler",variant:"secondary",onClick:shell.close});
    const submit = createButton({label:item ? "Enregistrer" : "Proposer",type:"submit"}); actions.append(cancel,submit); form.append(status,actions); shell.modal.append(info,form);
    const stopDraft = registerSuggestionDraft({label:`Idée surprise pour ${ownerName}`, apply: product => {
      if (disposed || saving || submit.disabled || !shell.modal.isConnected) return false;
      for (const field of fields) {
        if (["name","price","url"].includes(field.name)) field.control.value=product[/** @type {"name"|"price"|"url"} */ (field.name)];
      }
      if (product.image) {
        const transfer=new DataTransfer();transfer.items.add(new File([product.image],"produit.webp",{type:"image/webp"}));file.files=transfer.files;file.dispatchEvent(new Event("change"));
      }
      status.textContent="Informations récupérées. Vérifie le souhait avant de le proposer.";
      return true;
    }});
    registerComponentCleanup(shell.modal, stopDraft);
    const importHint=document.createElement("p");importHint.className="form-field__description";
    importHint.textContent=`Depuis la page produit, ouvre l’extension MonKado et choisis « Idée surprise pour ${ownerName} ».`;
    if (link) link.element.append(importHint);
    addComponentEventListener(form, form, "submit", event => {
      event.preventDefault();
      if (saving || submit.disabled) return;
      shared.discardDeferredBlur();
      let valid = true;
      for (const field of fields) { const message = validateWishField(field.name,field.control.value); setFormFieldValidation(field.element,message); if (message) valid=false; }
      if (file.files?.length && removeImage.checked) { status.textContent="Choisis une nouvelle image ou retire l’image existante."; valid=false; }
      if (!valid) return;
      /** @type {import("./groupSuggestionsService.js").SuggestionValues} */ const values = /** @type {any} */ (Object.fromEntries(fields.map(field => [field.name,field.control.value])));
      const selected = file.files?.[0] ?? null;
      saving=true; submit.disabled=cancel.disabled=choose.disabled=file.disabled=true; shell.setBusy(true); shared.syncQuantityControls(); status.textContent="Enregistrement…";
      void (async () => {
        let saved = false;
        try {
          if (selected) {
            await validateWishImageFile(selected);
            const preview = URL.createObjectURL(selected);
            try { await decodeWishImage(preview,lifetime.signal); } finally { URL.revokeObjectURL(preview); }
          }
          let result = item ? await service.update(item.id,values,item.entityTag,lifetime.signal) : await service.create(values,lifetime.signal);
          saved = true;
          if (selected) result = await service.uploadImage(result.id,selected,result.entityTag,lifetime.signal);
          else if (item?.hasImage && removeImage.checked) await service.removeImage(result.id,result.entityTag,lifetime.signal);
          completed();
        } catch (error) {
          saving=false; shell.setBusy(false); cancel.disabled=false; shared.syncQuantityControls();
          if (error instanceof WishImageValidationError) { status.textContent=error.message; submit.disabled=choose.disabled=file.disabled=false; return; }
          failed(shell,status,error,saved ? "L’idée a été enregistrée ; l’image n’a pas été confirmée. " : "");
        }
      })();
    });
  }

  /** @param {Suggestion} item Idea to delete. */
  function openDelete(item) {
    const shell = openDialog("Supprimer cette idée ?"); if (!shell) return;
    const message = document.createElement("p"); message.textContent = `Supprimer « ${item.name} » ?`;
    const status = document.createElement("p"); status.setAttribute("role","alert");
    const cancel = createButton({label:"Annuler",variant:"secondary",onClick:shell.close});
    const confirm = createButton({label:"Supprimer",onClick:() => {
      cancel.disabled=confirm.disabled=true; shell.setBusy(true);
      void service.remove(item.id,item.entityTag,lifetime.signal).then(completed).catch(error => { shell.setBusy(false); cancel.disabled=false; failed(shell,status,error); });
    }});
    const actions = document.createElement("div"); actions.className="cluster"; actions.append(cancel,confirm); shell.modal.append(message,status,actions);
  }

  /** @param {Suggestion} item Selected idea. */
  function openReservation(item) {
    const shell = openDialog("Réserver cette idée"); if (!shell) return;
    const content = document.createElement("div"); content.className="flow"; content.textContent="Chargement de la réservation…"; shell.modal.append(content);
    shell.setBusy(true);
    void (async () => {
      try {
        const fresh = await service.get(item.id,lifetime.signal);
        const reservation = await service.reservation(item.id,lifetime.signal);
        if (disposed || !shell.modal.isConnected) return;
        shell.setBusy(false); content.replaceChildren();
        const name = document.createElement("p"); name.textContent=fresh.name; content.append(name);
        const available = fresh.quantity-fresh.reservedQuantity+(reservation?.quantity ?? 0);
        const status = document.createElement("p"); status.setAttribute("role","alert");
        const form = document.createElement("form"); form.className="flow";
        const input = document.createElement("input"); input.type="number"; input.min="1"; input.max=String(available); input.step="1"; input.value=String(reservation?.quantity ?? 1);
        const field = createFormField({label:"Quantité à réserver",control:input,required:true}); form.append(field);
        const actions = document.createElement("div"); actions.className="cluster";
        const close = createButton({label:"Fermer",variant:"secondary",onClick:shell.close});
        const save = createButton({label:reservation ? "Enregistrer" : "Confirmer la réservation",type:"submit"}); save.disabled=available < 1;
        actions.append(close,save);
        if (reservation) {
          actions.append(createButton({label:"Annuler ma réservation",variant:"secondary",onClick:() => {
            content.replaceChildren(); const question=document.createElement("p"); question.textContent=`Annuler ta réservation pour « ${fresh.name} » ?`;
            const keep=createButton({label:"Conserver ma réservation",variant:"secondary",onClick:() => { shell.close(); openReservation(fresh); }});
            const cancel=createButton({label:"Confirmer l’annulation",onClick:() => {
              keep.disabled=cancel.disabled=true; shell.setBusy(true);
              void service.cancel(item.id,reservation.etag,lifetime.signal).then(completed).catch(error => {shell.setBusy(false);keep.disabled=false;failed(shell,status,error);});
            }});
            const row=document.createElement("div"); row.className="cluster"; row.append(keep,cancel); content.append(question,status,row);
          }}));
        }
        form.append(status,actions); content.append(form);
        addComponentEventListener(form,form,"submit",event => {
          event.preventDefault(); const count=Number(input.value);
          if (!Number.isInteger(count) || count < 1 || count > available) { setFormFieldValidation(field,`Choisis une quantité entre 1 et ${available}.`); return; }
          for (const button of actions.querySelectorAll("button")) button.disabled=true;
          shell.setBusy(true);
          void service.reserve(item.id,count,reservation?.etag ?? null,lifetime.signal).then(completed).catch(error => {shell.setBusy(false);close.disabled=false;failed(shell,status,error);});
        });
      } catch (error) { shell.setBusy(false); content.replaceChildren(); failed(shell,content,error); }
    })();
  }
}
