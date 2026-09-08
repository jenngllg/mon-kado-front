import { ApiError, isAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { createAlert, createButton, disposeComponent } from "../../components/index.js";
import { registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createWishImage } from "./wishImage.js";

/** Finishes only an image for a gift whose creation is already confirmed.
 * @param {{wishlistId: string, created: import("./wishesService.js").CreatedWish, image: Blob,
 * uploadImage: import("./wishesService.js").UploadWishImage, loadWish: import("./wishesService.js").LoadWish,
 * loadWishlist: import("../wishlists/wishlistsService.js").LoadWishlist,
 * onComplete: (created: import("./wishesService.js").CreatedWish) => Promise<void>, signal: AbortSignal}} options In-memory completion.
 */
export function createWishImportCompletion({ wishlistId, created, image, uploadImage, loadWish, loadWishlist, onComplete, signal }) {
  const element = document.createElement("section"); element.className = "flow";
  const title = document.createElement("h2"); title.textContent = "Cadeau ajouté"; title.tabIndex = -1;
  const feedback = document.createElement("div"); const current = document.createElement("div"); current.className = "wish-image-section__media";
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const reread = createButton({ label: "Relire le cadeau", variant: "secondary", onClick: () => { void read(); } });
  const send = createButton({ label: "Enregistrer l’image proposée", onClick: () => { void upload(); } });
  let disposed = false, busy = false, blocked = false, completed = false, terminal = false;
  /** @type {Blob | null} */ let selection = image;
  /** @type {import("./wishesService.js").CreatedWish | null} */ let reference = created;
  element.append(title, status, feedback, current, reread, send);
  registerComponentCleanup(element, () => { disposed = true; selection = null; reference = null; disposeComponent(current); current.replaceChildren(); disposeComponent(feedback); feedback.replaceChildren(); status.textContent = ""; sync(); });
  sync(); void upload();
  return element;

  function sync() { reread.hidden = disposed || completed || terminal || !blocked; reread.disabled = busy; send.hidden = disposed || completed || terminal || blocked; send.disabled = busy; element.setAttribute("aria-busy", String(busy)); }
  function clear() { disposeComponent(feedback); feedback.replaceChildren(); }
  /** @param {unknown} error Safe failure. @param {boolean} reading List or gift recheck. */
  function failure(error, reading) {
    blocked = true; clear(); const safe = toUserFacingError(error); let message = "Cadeau ajouté. L’enregistrement de son image n’a pas pu être confirmé.";
    const details = [safe.message];
    if (error instanceof ApiError) {
      if (error.correlationId) details.push(`Référence : ${error.correlationId}`);
      if (error.statusCode === 429 && error.retryAfterSeconds !== null) details.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      if (error.errorCode === "WISHLIST_SUSPENDED") message = "Cadeau ajouté. Liste suspendue — Consultation uniquement. Relis le cadeau avant de reprendre.";
      else if (error.errorCode === "WISH_IMAGE_NOT_FOUND") message = "Cadeau ajouté. Image indisponible : relis le cadeau avant de reprendre.";
      else if (error.statusCode === 404) { message = "Ce cadeau ou sa liste n’est plus disponible. Aucune nouvelle création ne sera effectuée."; terminal = true; selection = null; reference = null; disposeComponent(current); current.replaceChildren(); }
      else if (error.statusCode === 413) details.push("L’image ne doit pas dépasser 10 Mio.");
      else if (error.statusCode === 415 || error.errorCode === "WISH_IMAGE_UNSUPPORTED_FORMAT") details.push("L’image proposée ne peut pas être utilisée.");
      else if (error.errorCode === "WISH_IMAGE_INVALID") details.push("L’image proposée est invalide.");
    }
    if (reading && !terminal) details.push("La relecture doit réussir avant un nouvel enregistrement de l’image.");
    const alert = createAlert({ variant: "warning", title: "Image à vérifier", message, detail: details.join(" ") }); alert.tabIndex = -1; feedback.append(alert); alert.focus();
  }
  async function upload() {
    if (disposed || signal.aborted || busy || blocked || completed || terminal || !reference || !selection) return;
    busy = true; clear(); status.textContent = "Enregistrement de l’image…"; sync();
    try {
      const saved = await uploadImage(wishlistId, reference.wish.id, selection, { etag: reference.etag, signal });
      if (disposed || signal.aborted) return;
      completed = true; selection = null; reference = saved; clear();
      feedback.append(createAlert({ variant: "success", title: "Cadeau ajouté", message: "Le cadeau et son image sont enregistrés." }));
      await onComplete(saved);
    } catch (error) {
      if (disposed || signal.aborted || isAbortError(error)) return;
      if (completed) { clear(); feedback.append(createAlert({ variant: "success", title: "Cadeau ajouté", message: "Le cadeau et son image sont enregistrés. Utilise le retour à la liste pour les consulter." })); }
      else failure(error, false);
    } finally { if (!disposed) { busy = false; status.textContent = ""; sync(); } }
  }
  async function read() {
    if (disposed || signal.aborted || busy || completed || terminal || !reference) return;
    busy = true; blocked = true; clear(); status.textContent = "Relecture du cadeau…"; sync();
    try {
      const list = await loadWishlist(wishlistId, { signal }); if (disposed || signal.aborted) return;
      if (list.wishlist.isSuspended) throw new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" });
      const fresh = await loadWish(wishlistId, reference.wish.id, { signal }); if (disposed || signal.aborted) return;
      if (!isStrongEntityTag(fresh.etag)) throw new ApiError({ kind: "invalidResponse" });
      reference = fresh; disposeComponent(current); current.replaceChildren(createWishImage(fresh.wish)); blocked = false;
      feedback.append(createAlert({ variant: "info", title: "Image actuelle du cadeau", message: "Vérifie l’image enregistrée avant d’envoyer celle proposée. Cet enregistrement remplacera l’image actuelle, sans recréer le cadeau." })); title.focus();
    } catch (error) { if (!disposed && !signal.aborted && !isAbortError(error)) failure(error, true); }
    finally { if (!disposed) { busy = false; status.textContent = ""; sync(); } }
  }
}
