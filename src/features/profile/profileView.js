import { ApiError, isAbortError } from "../../api/apiError.js";
import { DisplayNameServerMessage, validateDisplayName } from "../../auth/displayNameValidation.js";
import { createActionLink, createAlert, createButton, createFormField, createLoadingState, disposeComponent,
  setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createPrivacyNotice } from "../../components/legalLinks.js";
import { createProfileImageSection } from "./profileImageSection.js";

/** Creates the protected profile editor with view-owned drafts and cancellation.
 * @param {{load: import("./profileService.js").LoadProfile, save: import("./profileService.js").SaveProfile,
 * uploadImage?: import("./profileImageService.js").UploadProfileImage, removeImage?: import("./profileImageService.js").RemoveProfileImage,
 * decodeImage?: typeof import("../wishes/wishImageValidation.js").decodeWishImage, signal?: AbortSignal}} options Operations.
 * @returns {HTMLElement} Routed component.
 */
export function createProfileView({ load, save, uploadImage, removeImage, decodeImage, signal }) {
  const view = textElement("section", "");
  view.className = "profile-view flow";
  const title = textElement("h1", "Mon profil");
  const feedback = textElement("div", "");
  feedback.hidden = true;
  feedback.tabIndex = -1;
  const loading = createLoadingState({ label: "Chargement du profil…" });
  const information = textElement("dl", "");
  information.className = "profile-view__identity";
  information.hidden = true;
  const email = textElement("dd", "");
  information.append(textElement("dt", "Adresse e-mail"), email);
  const form = document.createElement("form");
  form.noValidate = true;
  form.hidden = true;
  form.className = "profile-form flow";
  form.setAttribute("aria-label", "Modifier mon profil");
  const input = document.createElement("input");
  input.name = "displayName";
  input.type = "text";
  input.setAttribute("autocomplete", "nickname");
  const field = createFormField({ control: input, label: "Nom d’affichage", required: true,
    description: "Le nom que les autres verront. 80 caractères maximum." });
  const comparison = textElement("div", "");
  comparison.className = "profile-view__comparison flow";
  comparison.hidden = true;
  const currentValue = textElement("p", "");
  const useCurrent = createButton({ label: "Utiliser la valeur enregistrée", variant: "secondary", onClick: resetDraft });
  comparison.append(currentValue, useCurrent);
  const submit = createButton({ label: "Enregistrer les modifications", type: "submit" });
  const cancel = createButton({ label: "Annuler les modifications", variant: "ghost", onClick: resetDraft });
  const actions = textElement("div", "");
  actions.className = "cluster";
  actions.append(submit, cancel);
  form.append(field, comparison, createPrivacyNotice("Ton nom d’affichage sert à t’identifier dans les listes et participations. Choisis un pseudonyme si tu ne souhaites pas afficher ton nom civil."), actions);
  view.append(title, textElement("p", "Consulte tes informations et choisis le nom que tes proches verront."),
    feedback, loading, information, form,
    createActionLink({ label: "Changer mon mot de passe", href: RoutePaths.PasswordChange }),
    createActionLink({ label: "Changer mon adresse e-mail", href: RoutePaths.EmailChange }),
    createActionLink({ label: "Gérer mon authentificateur", href: RoutePaths.Authenticator }),
    createActionLink({ label: "Mes données personnelles", href: RoutePaths.PersonalData }));

  const lifetime = new AbortController();
  /** @type {import("./profileService.js").Profile | null} */
  let base = null;
  let disposed = false;
  let busy = false;
  let saving = false;
  let needsRead = true;
  let conflict = false;
  let checked = false;
  let dirty = false;
  let validationSummary = false;
  /** @type {HTMLElement | null} */
  let pressedAction = null;
  let deferredBlur = false;
  /** @type {string | null} */
  let fieldError = null;
  /** @type {import("./profileService.js").Profile | null} */ let photoBase = null;
  let photoBusy = false, confirmingPhoto = false, photoNeedsRead = false;
  let photoNotice = "";
  const photoFeedback = textElement("div", ""); photoFeedback.className = "flow";
  const photoSuccess = textElement("p", ""); photoSuccess.setAttribute("role", "status"); photoSuccess.hidden = true;
  const photoConfirmation = textElement("div", ""); photoConfirmation.className = "flow"; photoConfirmation.hidden = true;
  const photoConfirmationTitle = textElement("h3", "Supprimer ta photo de profil ?"); photoConfirmationTitle.tabIndex = -1;
  const confirmPhoto = createButton({ label: "Supprimer la photo", variant: "danger", onClick: () => { void mutatePhoto(null); } });
  const cancelPhoto = createButton({ label: "Annuler", variant: "secondary", onClick: () => {
    if (!active() || busy) return;
    confirmingPhoto = false; updateControls(); photoSection?.focusRemove();
  } });
  const confirmationActions = textElement("div", ""); confirmationActions.className = "cluster"; confirmationActions.append(cancelPhoto, confirmPhoto);
  photoConfirmation.append(photoConfirmationTitle, textElement("p", "Seule ta photo sera supprimée. Ton compte et tes informations seront conservés."), confirmationActions);
  const photoSection = uploadImage && removeImage ? createProfileImageSection({ decode: decodeImage,
    onUpload: file => { void mutatePhoto(file); }, onRemove: () => { void readPhoto("confirm"); }, onRefresh: () => { void readPhoto("recover"); } }) : null;
  if (photoSection) {
    photoSection.element.append(photoSuccess, photoFeedback, photoConfirmation);
    form.after(photoSection.element);
  }

  addComponentEventListener(view, input, "input", () => {
    dirty = true;
    if (checked) validate();
    if (!conflict && !needsRead && feedback.querySelector(".ui-alert--success")) clearFeedback();
    updateControls();
  });
  // A blur error must not move the pressed action between pointer-down and click.
  addComponentEventListener(view, form, "pointerdown", event => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    pressedAction = target === submit || target === cancel || target === useCurrent ? target : null;
  });
  addComponentEventListener(view, input, "blur", event => {
    if (!dirty) return;
    deferredBlur = pressedAction !== null && (/** @type {FocusEvent} */ (event)).relatedTarget === pressedAction;
    if (!deferredBlur) validate();
  });
  addComponentEventListener(view, document, "pointerup", event => {
    const completed = event.target instanceof Node && pressedAction?.contains(event.target);
    pressedAction = null;
    if (deferredBlur && !completed) validate();
    deferredBlur = false;
  });
  addComponentEventListener(view, document, "pointercancel", () => {
    pressedAction = null;
    if (deferredBlur) validate();
    deferredBlur = false;
  });
  addComponentEventListener(view, form, "submit", event => { event.preventDefault(); void submitProfile(); });
  registerComponentCleanup(view, () => {
    disposed = true;
    lifetime.abort();
    base = null;
    photoBase = null; photoNotice = ""; photoSuccess.textContent = ""; photoFeedback.replaceChildren(); photoConfirmation.hidden = true;
    input.value = "";
    email.textContent = "";
    currentValue.textContent = "";
    feedback.replaceChildren();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void readProfile("initial", false);
  return view;

  function active() { return !disposed && !lifetime.signal.aborted; }

  function clearFeedback() {
    disposeComponent(feedback);
    feedback.replaceChildren();
    feedback.hidden = true;
    validationSummary = false;
  }

  /** @param {Parameters<typeof createAlert>[0]} options Safe copy. */
  function showFeedback(options) {
    clearFeedback();
    feedback.hidden = false;
    feedback.append(createAlert(options));
  }

  function validate() {
    checked = true;
    fieldError = validateDisplayName(input.value);
    setFormFieldValidation(field, fieldError);
    if (validationSummary && fieldError === null) clearFeedback();
  }

  function clearValidation() {
    checked = false;
    dirty = false;
    fieldError = null;
    setFormFieldValidation(field, null);
  }

  function updateControls() {
    setButtonLoading(submit, saving);
    input.disabled = busy || confirmingPhoto;
    submit.disabled = busy || confirmingPhoto || needsRead || base === null || input.value.trim() === base.displayName;
    cancel.disabled = busy || confirmingPhoto || needsRead || base === null || (!conflict && input.value === base.displayName);
    useCurrent.disabled = busy || confirmingPhoto || needsRead;
    form.setAttribute("aria-busy", String(busy));
    loading.hidden = !busy || saving || photoBusy;
    photoSection?.update(photoBase?.photo ?? null, busy || confirmingPhoto, needsRead || photoNeedsRead, photoBase?.id);
    photoConfirmation.hidden = !confirmingPhoto;
    confirmPhoto.disabled = busy || photoNeedsRead || needsRead || !photoBase?.photo || !(photoBase.photo.imageUrl || photoBase.photo.imageUnavailable);
    cancelPhoto.disabled = busy;
    if (!saving) {
      const label = submit.querySelector(".ui-button__label");
      if (label) label.textContent = conflict ? "Enregistrer ma saisie" : "Enregistrer les modifications";
    }
  }

  function resetDraft() {
    if (!active() || busy || confirmingPhoto || needsRead || base === null) return;
    input.value = base.displayName;
    conflict = false;
    comparison.hidden = true;
    currentValue.textContent = "";
    clearValidation();
    clearFeedback();
    updateControls();
    input.focus();
  }

  /** @param {"initial" | "saved" | "conflict"} mode Recovery context.
   * @param {boolean} focus Whether the transition was an explicit action.
   */
  async function readProfile(mode, focus = true) {
    if (!active() || busy) return;
    needsRead = true;
    busy = true;
    updateControls();
    try {
      const profile = await load({ signal: lifetime.signal });
      if (!active()) return;
      base = profile;
      photoBase = profile; photoNeedsRead = false;
      needsRead = false;
      email.textContent = profile.email;
      information.hidden = false;
      form.hidden = false;
      clearValidation();
      conflict = mode === "conflict";
      comparison.hidden = !conflict;
      if (conflict) {
        currentValue.textContent = "Valeur actuellement enregistrée : " + profile.displayName;
        showFeedback({ variant: "warning", title: "Le profil a été modifié",
          message: "Ta saisie est conservée. Compare-la à la dernière valeur avant de choisir quoi enregistrer." });
      } else {
        input.value = profile.displayName;
        currentValue.textContent = "";
        if (mode === "saved") showFeedback({ variant: "success", title: "Modifications enregistrées", message: "Ton profil est à jour." });
        else clearFeedback();
      }
      busy = false;
      updateControls();
      if (focus) feedback.hidden ? input.focus() : feedback.focus();
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      showTechnicalError(error, mode === "saved");
      feedback.append(createButton({ label: "Réessayer", variant: "secondary",
        onClick: () => { void readProfile(mode); } }));
      if (focus) feedback.focus();
    } finally {
      if (active()) { busy = false; updateControls(); }
    }
  }

  /** @param {unknown} error Safe boundary error.
   * @param {boolean} [saved] Whether the write already succeeded.
   */
  function showTechnicalError(error, saved = false) {
    const translated = toUserFacingError(error);
    const details = [];
    if (translated.correlationId) details.push("Référence : " + translated.correlationId);
    if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) {
      details.push("Réessaie dans " + translated.retryAfterSeconds + " seconde(s).");
    }
    showFeedback({ variant: saved ? "warning" : "error",
      title: saved ? "Modifications enregistrées, actualisation impossible" : translated.title,
      message: saved ? "L’enregistrement a réussi. Réessaie uniquement l’actualisation du profil. " + translated.message : translated.message,
      detail: details.join(" ") || null });
  }

  async function submitProfile() {
    if (!active() || busy || confirmingPhoto || needsRead || base === null) return;
    validate();
    if (fieldError !== null) {
      showFeedback({ variant: "error", title: "Informations à vérifier", message: "Vérifie ton nom d’affichage avant de continuer." });
      validationSummary = true;
      input.focus();
      return;
    }
    if (input.value.trim() === base.displayName) return;
    clearFeedback();
    busy = true;
    saving = true;
    updateControls();
    try {
      const result = await save(input.value, { etag: base.etag, signal: lifetime.signal });
      if (!active()) return;
      input.value = result.displayName;
      base = Object.freeze({ ...base, ...result });
      showFeedback({ variant: "success", title: "Modifications enregistrées", message: "Actualisation du profil…" });
      busy = false;
      saving = false;
      await readProfile("saved");
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      busy = false;
      saving = false;
      const validations = error instanceof ApiError ? error.validationErrors : [];
      const precondition = error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 ||
        error.errorCode === "CLIENT_PROFILE_PRECONDITION_INVALID" || validations.some(item => item.propertyName === "ifMatch"));
      if (precondition) {
        conflict = true;
        await readProfile("conflict");
        return;
      }
      if (validations.length > 0) {
        if (validations.some(item => item.propertyName === "displayName")) {
          checked = true;
          fieldError = DisplayNameServerMessage;
          setFormFieldValidation(field, fieldError);
        }
        showFeedback({ variant: "error", title: "Informations à vérifier",
          message: "Certaines informations n’ont pas été acceptées. Vérifie ta saisie puis réessaie." });
        validationSummary = validations.every(item => item.propertyName === "displayName");
      } else showTechnicalError(error);
      if (error instanceof ApiError && error.kind === "invalidResponse") {
        needsRead = true;
        feedback.append(createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void readProfile("conflict"); } }));
      }
      updateControls();
      if (fieldError !== null) input.focus();
      else feedback.focus();
    } finally {
      if (active()) { busy = false; saving = false; updateControls(); }
    }
  }

  /** @param {string} message Safe status. @param {unknown} [error] Normalized failure. */
  function photoMessage(message, error) {
    disposeComponent(photoFeedback); photoFeedback.replaceChildren();
    if (photoSuccess.textContent !== photoNotice) photoSuccess.textContent = photoNotice;
    photoSuccess.hidden = !photoNotice;
    if (error) {
      const translated = toUserFacingError(error), detail = [];
      const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
      if (correlation) detail.push(`Référence : ${correlation}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) detail.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const alert = createAlert({ ...translated, message: message || translated.message, detail: detail.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      photoFeedback.append(alert); alert.focus();
    } else if (message) {
      const status = textElement("p", message); status.setAttribute("role", "status"); photoFeedback.append(status);
    }
  }

  /** @param {"confirm" | "recover" | "saved"} mode Reason for fresh account read. */
  async function readPhoto(mode) {
    if (!active() || busy || !photoSection) return;
    busy = true; photoBusy = true;
    if (mode === "confirm") confirmingPhoto = true;
    photoNeedsRead = true; photoMessage("Chargement de la photo…"); updateControls();
    try {
      const fresh = await load({ signal: lifetime.signal });
      if (!active()) return;
      photoBase = fresh; photoNeedsRead = false;
      if (mode !== "confirm") {
        const hasDraft = base !== null && input.value !== base.displayName;
        base = fresh; needsRead = false; email.textContent = fresh.email;
        conflict = hasDraft; comparison.hidden = !hasDraft;
        currentValue.textContent = hasDraft ? "Valeur actuellement enregistrée : " + fresh.displayName : "";
        if (!hasDraft) { input.value = fresh.displayName; clearValidation(); }
      }
      if (!(fresh.photo?.imageUrl || fresh.photo?.imageUnavailable)) confirmingPhoto = false;
      photoMessage("");
      if (conflict && mode !== "confirm") showFeedback({ variant: "warning", title: "Ta saisie est conservée",
        message: "Compare ton nom à la valeur enregistrée avant de choisir quoi enregistrer." });
      busy = false; photoBusy = false; updateControls();
      (confirmingPhoto ? photoConfirmationTitle : photoSection.title).focus();
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      needsRead = true; photoNeedsRead = true;
      photoMessage(photoNotice ? "La modification a réussi. Réessaie uniquement la lecture du profil." : "Relis le profil avant de modifier sa photo.", error);
      photoFeedback.append(createButton({ label: "Relire le profil", variant: "secondary", onClick: () => { void readPhoto(mode === "confirm" ? "recover" : mode); } }));
    } finally { if (active()) { busy = false; photoBusy = false; updateControls(); } }
  }

  /** @param {Blob | null} file Null selects the explicitly confirmed deletion. */
  async function mutatePhoto(file) {
    if (!active() || busy || needsRead || photoNeedsRead || !photoBase || !photoSection || !uploadImage || !removeImage || (!file && !confirmingPhoto)) return;
    busy = true; photoBusy = true; photoNotice = ""; updateControls();
    photoMessage(file ? "Enregistrement de ta photo…" : "Suppression de ta photo…");
    try {
      const options = { etag: photoBase.etag, signal: lifetime.signal };
      if (file) await uploadImage(file, options); else await removeImage(options);
      if (!active()) return;
      photoNotice = file ? "Photo enregistrée" : "Photo supprimée";
      photoSection.clearSelection(); confirmingPhoto = false; needsRead = true; photoNeedsRead = true;
      busy = false; photoBusy = false;
      await readPhoto("saved");
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      const api = error instanceof ApiError ? error : null;
      const precondition = api && (api.statusCode === 412 || api.statusCode === 428 || api.errorCode === "CLIENT_PROFILE_PRECONDITION_INVALID" || api.validationErrors.some(item => item.propertyName === "ifMatch"));
      const uncertain = !api || api.kind !== "http" || (api.statusCode ?? 0) >= 500;
      const missing = api?.errorCode === "ACCOUNT_PROFILE_IMAGE_NOT_FOUND";
      let message = "";
      if (precondition || uncertain || missing) {
        needsRead = true; photoNeedsRead = true;
        message = precondition ? "Ton profil a été modifié ailleurs. Relis le profil avant de confirmer à nouveau la modification de ta photo."
          : missing ? "La photo est indisponible. Relis le profil pour vérifier son état."
            : "La modification de ta photo ne peut pas être confirmée. Relis ton profil avant de réessayer.";
      } else if (api?.statusCode === 413) message = "La photo ne doit pas dépasser 10 Mio.";
      else if (api?.statusCode === 415 || api?.errorCode === "ACCOUNT_PROFILE_IMAGE_UNSUPPORTED_FORMAT") message = "Choisis une photo JPEG, PNG ou WebP non animée.";
      else if (api?.errorCode === "ACCOUNT_PROFILE_IMAGE_INVALID") message = "Cette photo ne peut pas être utilisée. Choisis une autre image lisible, de 40 millions de pixels maximum.";
      photoMessage(message, error);
      if (photoNeedsRead) photoFeedback.append(createButton({ label: "Relire le profil", variant: "secondary", onClick: () => { void readPhoto("recover"); } }));
    } finally { if (active()) { busy = false; photoBusy = false; updateControls(); } }
  }
}

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag Native tag.
 * @param {string} value Text, never markup.
 * @returns {HTMLElementTagNameMap[T]} Native element.
 */
function textElement(tag, value) {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}
