import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createBackLink, createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { createImagePlaceholder } from "../../components/imagePlaceholder.js";
import { safeHttpUrl } from "../wishes/wishValidation.js";
import { decodeWishImage, validateWishImageFile, WishImageValidationError } from "../wishes/wishImageValidation.js";
import { createWishForm } from "../wishes/wishForm.js";
import { registerSuggestionDraft } from "../extension/suggestionDraft.js";
import { createGroupSuggestionBatch } from "./groupSuggestionBatch.js";
import { prependShareDialogIcon } from "../../components/shareDialogIcons.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { createWishDetailInformation, createWishDetailProductLink } from "../wishes/wishDetailPresentation.js";
import { createWishImage } from "../wishes/wishImage.js";
import { withWishSort } from "../wishes/wishSorting.js";
import { createActionDisclosure } from "../../components/actionDisclosure.js";

/** @typedef {import("./groupSuggestionsService.js").Suggestion} Suggestion */
/** @typedef {ReturnType<typeof import("./groupSuggestionsService.js").createGroupSuggestionsService>} SuggestionService */

/** Displays and manages ideas in the exact group, excluding the list owner.
 * @param {{service:SuggestionService,ownerName:string,signal:AbortSignal,creationOnly?:boolean,listHref?:string,getReturnSort?:()=>string|null,detailId?:string,loadOwnerName?:(signal:AbortSignal)=>Promise<string>,setTitle?:(title:string)=>void,navigate?:(href:string)=>void,loadDestinations?:(signal:AbortSignal)=>Promise<import("./groupSuggestionBatch.js").SuggestionDestination[]>}} options Scoped dependencies.
 * @returns {HTMLElement} Disposable section.
 */
export function createGroupSuggestionsView({ service, ownerName, signal, creationOnly = false, loadDestinations, listHref = location.pathname + location.search, getReturnSort, detailId, loadOwnerName, setTitle = () => {}, navigate = href => { location.assign(href); } }) {
  const root = document.createElement("section"); root.className = "group-suggestions flow";
  const header = document.createElement("div"); header.className = "section-toolbar";
  const title = document.createElement("h2"); title.textContent = "Idées surprises proposées";
  const add = createButton({label:"Proposer une idée", onClick: () => openEditor(null)});
  add.classList.add("group-suggestions__add");
  header.append(title, add);
  const explanation = document.createElement("p"); explanation.textContent = `Visibles par les membres de ce groupe, sauf ${ownerName}.`;
  const feedback = document.createElement("p"); feedback.setAttribute("role", "status");
  const items = document.createElement("div"); items.className = "group-suggestions__items";
  root.append(header, explanation, feedback, items);
  if (creationOnly) { root.classList.add("group-suggestions--action"); root.replaceChildren(add, feedback); }
  const pageTitle = document.createElement("h1"); pageTitle.textContent = "Idée surprise"; pageTitle.tabIndex = -1;
  const detailResults = document.createElement("div"); detailResults.className = "shared-wish-results flow";
  const commandHost = document.createElement("div"); commandHost.className = "wish-detail__commands";
  if (detailId) {
    root.className = "shared-wish-view wish-owner-detail group-suggestion-page flow";
    const toolbar = document.createElement("div"); toolbar.className = "wish-detail__toolbar";
    toolbar.append(createBackLink({label:"Retour à la liste",href:`${listHref}#suggestion-${detailId}`}), commandHost);
    root.replaceChildren(toolbar, pageTitle, detailResults);
  }
  const lifetime = new AbortController();
  /** @type {Set<string>} */ const objectURLs = new Set();
  /** @type {HTMLDialogElement | null} */ let dialog = null;
  let disposed = false, generation = 0, reading = false;
  addComponentEventListener(root, signal, "abort", () => disposeComponent(root), {once:true});
  registerComponentCleanup(root, () => { disposed = true; generation++; lifetime.abort(); closeDialog(); releaseImages(); disposeComponent(add); add.remove(); items.replaceChildren(); detailResults.replaceChildren(); commandHost.replaceChildren(); pageTitle.textContent = ""; });
  if (signal.aborted) disposeComponent(root); else if (detailId) void readDetail(); else if (!creationOnly) void refresh();
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
      const list = document.createElement("ul"); list.className = "group-suggestions__grid wish-grid wish-grid--gallery"; list.setAttribute("role", "list");
      /** @type {{item:Suggestion,host:HTMLElement}[]} */ const pendingImages = [];
      for (const item of suggestions) {
        const card = document.createElement("li"); card.className = "group-suggestions__card wish-card wish-card--gallery wish-card--row wish-card--reading"; card.id = `suggestion-${item.id}`;
        const mediaColumn = document.createElement("div"); mediaColumn.className = "wish-reading__media";
        const target = new URL(listHref, location.origin); target.pathname += `/suggestions/${item.id}`;
        const href = withWishSort(target.pathname + target.search,getReturnSort?.() ?? target.searchParams.get("sort"));
        const photo = document.createElement("a"); photo.className = "wish-gallery__photo"; photo.href = href; photo.setAttribute("aria-label", `Voir l’idée « ${item.name} »`);
        const media = document.createElement("div"); media.className = "group-suggestions__media wish-card__media"; media.append(createImagePlaceholder("Sans image"));
        photo.append(media); mediaColumn.append(photo);
        if (item.hasImage) pendingImages.push({item,host:media});
        const content = document.createElement("div"); content.className = "group-suggestions__content wish-gallery__content";
        const name = document.createElement("h3");
        const open = createActionLink({label:item.name,href}); open.classList.add("group-suggestions__open"); open.setAttribute("aria-label", `Voir l’idée « ${item.name} »`); name.append(open);
        const author = document.createElement("p"); author.className = "group-suggestions__author"; author.textContent = `Idée proposée par ${item.authorDisplayName ?? "un membre supprimé"}`;
        content.append(name, author);
        if (item.price !== null) { const price = document.createElement("p"); price.textContent = new Intl.NumberFormat("fr-FR", {style:"currency",currency:"EUR"}).format(item.price); content.append(price); }
        if (item.currentParticipantReservedQuantity) { const mine = document.createElement("p"); mine.textContent = `Tu as réservé ${item.currentParticipantReservedQuantity} exemplaire${item.currentParticipantReservedQuantity > 1 ? "s" : ""}.`; content.append(mine); }
        if (item.currentParticipantReservedQuantity || item.reservedQuantity < item.quantity) {
          const reserve = createButton({label:item.currentParticipantReservedQuantity ? "Ma réservation" : "Réserver", onClick: () => openReservation(item, reserve)});
          reserve.classList.add("wish-reading__reserve"); mediaColumn.append(reserve);
        }
        if (item.canEdit) {
          const remove = createButton({label:"Supprimer",variant:"secondary",onClick:() => openDelete(item, remove)});
          applyActionIcon(remove, "delete", `Supprimer l’idée « ${item.name} »`);
          remove.classList.add("group-suggestions__delete", "icon-action--danger");
          remove.disabled = item.reservedQuantity > 0;
          if (item.reservedQuantity > 0) remove.title = "Une idée réservée ne peut pas être modifiée ou supprimée.";
          card.append(remove);
          if (item.reservedQuantity > 0) { const notice = document.createElement("p"); notice.textContent = "Cette idée ne peut pas être modifiée ou supprimée tant qu’elle est réservée."; content.append(notice); }
        }
        card.prepend(mediaColumn, content); list.append(card);
      }
      items.append(list);
      // At most three authenticated image requests may be active at once.
      let next = 0;
      async function loadImages() {
        while (!disposed && current === generation && next < pendingImages.length) {
          const entry = pendingImages[next++];
          try {
            const blob = await service.image(entry.item.id, lifetime.signal, { thumbnail: true });
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

  /** @param {string} heading Dialog title. @param {HTMLElement} trigger Focus destination on dismissal. */
  function openDialog(heading, trigger = add) {
    if (disposed || dialog) return null;
    const modal = document.createElement("dialog"); modal.className = "wishlist-report-dialog group-suggestions__dialog flow";
    const label = document.createElement("h2"); label.textContent = heading; label.id = `suggestion-dialog-${crypto.randomUUID()}`; label.tabIndex = -1;
    modal.setAttribute("aria-labelledby",label.id); modal.append(label);
    let busy = false;
    const close = () => { if (!busy) { closeDialog(); (trigger.isConnected ? trigger : add).focus(); } };
    const dismiss = createButton({ label: "Fermer l’idée", variant: "secondary", onClick: close });
    dismiss.setAttribute("aria-label", "Fermer l’idée"); dismiss.title = "Fermer l’idée";
    dismiss.replaceChildren(); prependShareDialogIcon(dismiss, "close"); dismiss.classList.add("icon-action", "wishlist-share-dialog__close"); modal.prepend(dismiss);
    addComponentEventListener(modal, modal, "cancel", event => { event.preventDefault(); close(); });
    registerComponentCleanup(modal, () => { if (modal.open) modal.close(); modal.remove(); });
    dialog = modal; root.append(modal); modal.showModal(); label.focus();
    return {modal,close,setBusy: (/** @type {boolean} */ value) => {busy=value; dismiss.disabled=value; modal.setAttribute("aria-busy",String(value));}};
  }

  async function readDetail() {
    if (disposed || reading || !detailId) return;
    reading = true; const current = ++generation;
    disposeComponent(commandHost); commandHost.replaceChildren();
    if (detailResults.contains(pageTitle)) root.insertBefore(pageTitle, detailResults);
    disposeComponent(detailResults); detailResults.replaceChildren(); releaseImages();
    detailResults.textContent = "Chargement de l’idée…"; detailResults.setAttribute("aria-busy", "true");
    try {
      const [fresh, audience] = await Promise.all([service.get(detailId, lifetime.signal), loadOwnerName ? loadOwnerName(lifetime.signal) : Promise.resolve(ownerName)]);
      if (disposed || current !== generation) return;
      ownerName = audience; detailResults.replaceChildren(); pageTitle.textContent = fresh.name; setTitle(`${fresh.name} · MonKado`);
      const layout = document.createElement("div"); layout.className = "shared-wish-layout";
      const product = document.createElement("div"); product.className = "shared-wish-product flow";
      const media = createWishImage({imageUrl:null,imageUnavailable:false}); product.append(media);
      const url = fresh.url ? safeHttpUrl(fresh.url) : null;
      const information = createWishDetailInformation({...fresh,url:url?.href ?? null}, pageTitle);
      const author = document.createElement("p"); author.textContent = `Idée proposée par ${fresh.authorDisplayName ?? "un membre supprimé"}`;
      information.append(author);
      if (url) information.querySelector(".wish-detail__merchant")?.append(createWishDetailProductLink(url.href,fresh.name));
      if (fresh.canEdit) {
        const actions = document.createElement("div"); actions.className = "cluster wish-owner-detail__actions"; actions.setAttribute("role","group"); actions.setAttribute("aria-label","Actions de l’idée");
        const edit = createButton({label:"Modifier",onClick:() => openEditor(fresh,edit)});
        const remove = createButton({label:"Supprimer",variant:"secondary",onClick:() => { options.open = false; openDelete(fresh,options.querySelector("summary") ?? remove); }});
        remove.classList.add("workflow-menu-danger");
        const options = createActionDisclosure("⋯","Options de l’idée",[remove]); options.classList.add("workflow-options"); options.querySelector("summary")?.setAttribute("role","button");
        edit.disabled = remove.disabled = fresh.reservedQuantity > 0;
        if (fresh.reservedQuantity > 0) edit.title = remove.title = "Une idée réservée ne peut pas être modifiée ou supprimée.";
        actions.append(options,edit); commandHost.append(actions);
      }
      product.append(information);
      const reservation = document.createElement("aside"); reservation.className = "shared-wish-reservation flow"; reservation.setAttribute("aria-label","Réservation de cette idée");
      const quantity = document.createElement("p"); quantity.className = "wish-detail__desired"; quantity.textContent = `Quantité souhaitée : ${fresh.quantity}`;
      const available = document.createElement("p"); available.textContent = `${fresh.quantity-fresh.reservedQuantity} disponible${fresh.quantity-fresh.reservedQuantity > 1 ? "s" : ""}`;
      reservation.append(quantity,available);
      if (fresh.currentParticipantReservedQuantity || fresh.reservedQuantity < fresh.quantity) {
        const reserve = createButton({label:fresh.currentParticipantReservedQuantity ? "Ma réservation" : "Réserver",onClick:() => openReservation(fresh,reserve)}); reservation.append(reserve);
      }
      layout.append(product,reservation); detailResults.append(layout); pageTitle.focus();
      if (fresh.hasImage) void readDetailImage(fresh,media,current);
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      const status = document.createElement("p"); status.setAttribute("role","alert");
      const missing = error instanceof ApiError && [403,404].includes(error.statusCode ?? 0);
      status.textContent = missing ? "Cette idée n’est plus accessible dans ce groupe." : "Impossible de charger cette idée.";
      pageTitle.textContent = missing ? "Idée indisponible" : "Idée surprise";
      detailResults.replaceChildren(status);
      if (!missing) detailResults.append(createButton({label:"Réessayer",variant:"secondary",onClick:() => { void readDetail(); }}));
    } finally { reading = false; if (!disposed) detailResults.setAttribute("aria-busy","false"); }
  }

  /** @param {Suggestion} item Fresh idea. @param {HTMLElement} media Initial fallback. @param {number} current Read generation. */
  async function readDetailImage(item, media, current) {
    try {
      const blob = await service.image(item.id,lifetime.signal);
      if (disposed || current !== generation) return;
      const objectURL = URL.createObjectURL(blob); objectURLs.add(objectURL);
      const image = createWishImage({imageUrl:objectURL,imageUnavailable:false},{enlargeName:item.name});
      disposeComponent(media); media.replaceWith(image);
    } catch (error) { if (!disposed && current === generation && !isAbortError(error)) { disposeComponent(media); media.replaceWith(createWishImage({imageUrl:null,imageUnavailable:true})); } }
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
    const verify = createButton({label:"Actualiser les idées",variant:"secondary",onClick:() => { shell.close(); if (detailId) void readDetail(); else void refresh(); }});
    host.append(document.createTextNode(" "),verify);
  }
  function completed() { closeDialog(); if (detailId) { void readDetail(); return; } add.focus(); if (creationOnly) feedback.textContent = "Idée proposée dans les listes sélectionnées."; else void refresh(); }

  /** @param {Suggestion | null} item Existing idea or creation. @param {HTMLElement} trigger Focus destination on dismissal. */
  function openEditor(item, trigger = add) {
    const shell = openDialog(item ? "Modifier l’idée" : "Proposer une idée surprise", trigger); if (!shell) return;
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
    const details = document.createElement("details"); details.className = "suggestion-details";
    const detailsLabel = document.createElement("summary"); detailsLabel.textContent = "Précisions";
    const detailsBody = document.createElement("div"); detailsBody.className = "flow";
    const note = fields.find(field => field.name === "note"), quantity = fields.find(field => field.name === "quantity"), price = fields.find(field => field.name === "price");
    if (note) detailsBody.append(note.element); if (quantity) detailsBody.append(quantity.element);
    const amounts = form.querySelector(".wish-form__amounts"); if (price && amounts) amounts.before(price.element); amounts?.remove();
    details.append(detailsLabel, detailsBody); details.open = !!item && (!!item.note || item.quantity !== 1); form.append(details);
    const status = document.createElement("div"); status.setAttribute("role","alert"); status.tabIndex = -1;
    const actions = document.createElement("div"); actions.className="cluster group-suggestions__actions";
    const cancel = createButton({label:"Annuler",variant:"secondary",onClick:shell.close});
    const submit = createButton({label:item ? "Enregistrer" : "Proposer",type:"submit"}); actions.append(cancel,submit); form.append(status,actions); shell.modal.append(info,form);
    const batch = !item && loadDestinations ? createGroupSuggestionBatch() : null;
    /** @type {import("./groupSuggestionBatch.js").SuggestionDestination[]} */ let targets = [];
    const targetField = document.createElement("fieldset"); targetField.className = "suggestion-destinations flow";
    const targetLegend = document.createElement("legend"); targetLegend.textContent = "Listes *"; targetField.append(targetLegend);
    const targetChoices = document.createElement("div"); targetChoices.className = "suggestion-destinations__choices flow"; targetField.append(targetChoices);
    if (batch) { form.prepend(targetField); void readTargets(); }
    addComponentEventListener(shell.modal, targetField, "change", () => { if (!saving && !batch?.hasConfirmed()) submit.disabled = !targetField.querySelector("input:checked"); });
    async function readTargets() {
      if (!loadDestinations) return;
      submit.disabled = true; targetChoices.replaceChildren(); status.textContent = "Chargement des listes…";
      try {
        targets = await loadDestinations(lifetime.signal);
        if (disposed || !shell?.modal.isConnected) return;
        for (const [index, target] of targets.entries()) {
          const label = document.createElement("label"); label.className = "wishlist-group-visibility__choice";
          const input = document.createElement("input"); input.type = "checkbox"; input.name = "destinations"; input.value = target.id; input.checked = index === 0;
          label.append(input, document.createTextNode(`${target.name} — ${target.groupName}`)); targetChoices.append(label);
        }
        status.textContent = targets.length ? "" : "Cette personne n’a plus de liste accessible dans ce groupe."; submit.disabled = !targets.length;
      } catch (error) {
        if (disposed || !shell?.modal.isConnected || isAbortError(error)) return;
        status.textContent = "Impossible de charger les listes. "; status.append(createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void readTargets(); } }));
      }
    }
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
    importHint.textContent="Tu peux aussi préremplir cette idée avec l’extension MonKado.";
    detailsBody.append(importHint);
    addComponentEventListener(form, form, "submit", event => {
      event.preventDefault();
      if (saving || submit.disabled) return;
      shared.discardDeferredBlur();
      let valid = true;
      for (const field of fields) { shared.validate(field); if (field.error) valid=false; }
      if (file.files?.length && removeImage.checked) { status.textContent="Choisis une nouvelle image ou retire l’image existante."; valid=false; }
      if (!valid) {
        const invalid = ["url", "name", "price", "note", "quantity"].flatMap(name => fields.filter(field => field.name === name && field.error))[0];
        if (invalid) { if (details.contains(invalid.control)) details.open = true; invalid.control.focus(); }
        else status.focus();
        return;
      }
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
          if (batch) {
            const selectedIds = [...targetField.querySelectorAll('input:checked')].map(input => /** @type {HTMLInputElement} */ (input).value);
            const selectedTargets = targets.filter(target => selectedIds.includes(target.id));
            if (!selectedTargets.length) { saving = false; shell.setBusy(false); cancel.disabled = false; submit.disabled = true; return; }
            for (const input of form.querySelectorAll("input,textarea")) /** @type {HTMLInputElement} */ (input).disabled = true;
            const result = await batch.run(selectedTargets, values, selected, lifetime.signal);
            if (disposed || !shell.modal.isConnected) return;
            if (result.complete && result.outcomes.every(outcome => outcome.state === "saved")) { completed(); return; }
            saving = false; shell.setBusy(false); cancel.disabled = false;
            status.textContent = result.uncertain ? "Un ajout ne peut pas être confirmé. Vérifie la liste concernée avant tout nouvel ajout." : "Résultat des ajouts :";
            for (const outcome of result.outcomes) {
              const line = document.createElement("p");
              line.textContent = `${outcome.destination.name} — ${outcome.destination.groupName} : ${{saved:"idée ajoutée",imageUnconfirmed:"idée ajoutée, image à vérifier",refused:"ajout refusé",uncertain:"ajout à vérifier",notSent:"ajout non envoyé"}[outcome.state]}. `;
              const link = document.createElement("a"); link.href = outcome.destination.href; link.textContent = "Voir la liste"; line.append(link); status.append(line);
            }
            submit.disabled = result.uncertain || !result.retryable;
            const caption = submit.querySelector(".ui-button__label"); if (caption) caption.textContent = "Réessayer les listes refusées";
            if (!batch.hasConfirmed() && !result.uncertain) { for (const input of form.querySelectorAll("input,textarea")) /** @type {HTMLInputElement} */ (input).disabled = false; choose.disabled = file.disabled = false; }
            shared.syncQuantityControls(); return;
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

  /** @param {Suggestion} item Idea to delete. @param {HTMLElement} trigger Focus destination on dismissal. */
  function openDelete(item, trigger = add) {
    const shell = openDialog("Supprimer cette idée ?", trigger); if (!shell) return;
    const message = document.createElement("p"); message.textContent = `Supprimer « ${item.name} » ?`;
    const status = document.createElement("p"); status.setAttribute("role","alert");
    const cancel = createButton({label:"Annuler",variant:"secondary",onClick:shell.close});
    const confirm = createButton({label:"Supprimer",onClick:() => {
      cancel.disabled=confirm.disabled=true; shell.setBusy(true);
      void service.remove(item.id,item.entityTag,lifetime.signal).then(() => { if (detailId) { closeDialog(); navigate(listHref); } else completed(); }).catch(error => { shell.setBusy(false); cancel.disabled=false; failed(shell,status,error); });
    }});
    const actions = document.createElement("div"); actions.className="cluster"; actions.append(cancel,confirm); shell.modal.append(message,status,actions);
  }

  /** @param {Suggestion} item Selected idea. @param {HTMLElement} trigger Focus destination on dismissal. */
  function openReservation(item, trigger = add) {
    const shell = openDialog("Réserver cette idée", trigger); if (!shell) return;
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
