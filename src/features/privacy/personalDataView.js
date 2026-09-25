import { isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, disposeComponent, setButtonLoading } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

const StatusLabels = Object.freeze({ queued: "En attente de préparation", processing: "Préparation en cours", ready: "Archive disponible",
  failed: "La préparation a échoué", expired: "Archive expirée" });

/** Render private export lifecycle without background polling or automatic mutation retries.
 * @param {{service: ReturnType<typeof import("./personalDataService.js").createPersonalDataService>, signal?: AbortSignal}} options Operations.
 * @returns {HTMLElement} Disposable protected view.
 */
export function createPersonalDataView({ service, signal }) {
  const view = document.createElement("section");
  view.className = "flow";
  const heading = document.createElement("h1"); heading.textContent = "Mes données personnelles";
  const explanation = document.createElement("p");
  explanation.textContent = "Télécharge les données encore conservées pour ton compte. L’archive est personnelle : garde-la dans un endroit sûr. Elle ne permet pas de restaurer le compte.";
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const feedback = document.createElement("div"); feedback.tabIndex = -1;
  const lifetime = new AbortController();
  /** @type {import("./personalDataService.js").PersonalExport | null} */ let archive = null;
  /** @type {string | null} */ let downloadUrl = null;
  let disposed = false;
  let busy = false;
  const request = createButton({ label: "Demander mon export", onClick: () => { void execute(async () => {
    const result = await service.requestExport({ signal: lifetime.signal });
    if (!disposed) archive = result;
  }); } });
  const refresh = createButton({ label: "Actualiser l’état", variant: "secondary", onClick: () => { void execute(read); } });
  const download = createButton({ label: "Télécharger mon archive", onClick: () => { void execute(async () => {
    if (archive === null) return;
    const result = await service.download(archive, { signal: lifetime.signal });
    if (disposed) return;
    releaseDownload();
    downloadUrl = URL.createObjectURL(result.blob);
    const link = document.createElement("a"); link.href = downloadUrl; link.download = result.filename;
    view.append(link); link.click(); link.remove();
  }); } });
  const actions = document.createElement("div"); actions.className = "cluster";
  actions.append(request, refresh, download);
  const note = document.createElement("p");
  note.textContent = "La préparation est asynchrone. Tu peux revenir sur cette page ou actualiser son état ; aucun nouvel export n’est demandé automatiquement.";
  const deletion = document.createElement("section"); deletion.className = "flow";
  const deletionTitle = document.createElement("h2"); deletionTitle.textContent = "Supprimer mon compte";
  const deletionNote = document.createElement("p"); deletionNote.textContent = "Cette demande envoie un lien de confirmation à ton adresse e-mail. Le compte n’est pas supprimé à cette étape. Conserve ton export avant de confirmer la suppression.";
  const deletionStatus = document.createElement("p"); deletionStatus.setAttribute("role", "status");
  const deletionButton = createButton({ label: "Recevoir le lien de suppression", variant: "secondary", onClick: () => { void execute(async () => {
    await service.requestDeletion({ signal: lifetime.signal });
    if (!disposed) deletionStatus.textContent = "La demande est enregistrée. Consulte tes e-mails pour confirmer la suppression.";
  }); } });
  deletion.append(deletionTitle, deletionNote, deletionButton, deletionStatus);
  view.append(heading, explanation, status, feedback, actions, note, deletion);
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); releaseDownload(); archive = null; feedback.replaceChildren(); status.textContent = ""; deletionStatus.textContent = ""; });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void execute(read);
  return view;

  async function read() {
    const request = archive === null ? service.latest({ signal: lifetime.signal }) : service.refresh(archive.id, { signal: lifetime.signal });
    const result = await request;
    if (disposed) return;
    archive = result;
  }
  function releaseDownload() { if (downloadUrl !== null) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; } }
  function render() {
    setButtonLoading(refresh, busy);
    request.disabled = busy;
    refresh.disabled = busy;
    download.disabled = busy;
    deletionButton.disabled = busy;
    download.hidden = archive?.status !== "ready";
    status.textContent = busy ? "Lecture en cours…" : archive === null ? "Aucune demande d’export conservée." : StatusLabels[archive.status];
    if (!busy && archive?.expiresAt) status.textContent += " — Fin de disponibilité : " + new Date(archive.expiresAt).toLocaleString("fr-FR");
  }
  /** @param {() => Promise<void>} operation Single view-owned operation. */
  async function execute(operation) {
    if (disposed || busy) return;
    busy = true; disposeComponent(feedback); feedback.replaceChildren(); render();
    try { await operation(); }
    catch (error) {
      if (!disposed && !isAbortError(error)) {
        const safe = toUserFacingError(error);
        feedback.append(createAlert({ ...safe, variant: "error", detail: safe.retryAfterSeconds === null ? null : `Réessaie dans ${safe.retryAfterSeconds} seconde(s).` }));
        feedback.focus();
      }
    } finally { if (!disposed) { busy = false; render(); } }
  }
}
