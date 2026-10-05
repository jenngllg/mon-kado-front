import { refreshOnReturn } from "../../components/refreshOnReturn.js";
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
  /** @type {"read" | "request" | "download" | "deletion"} */ let operationKind = "read";
  const request = createButton({ label: "Demander mon export", onClick: () => { void execute(async () => {
    const result = await service.requestExport({ signal: lifetime.signal });
    if (!disposed) archive = result;
  }, "request"); } });
  const download = createButton({ label: "Télécharger mon archive", onClick: () => { void execute(async () => {
    if (archive === null) return;
    const result = await service.download(archive, { signal: lifetime.signal });
    if (disposed) return;
    releaseDownload();
    downloadUrl = URL.createObjectURL(result.blob);
    const link = document.createElement("a"); link.href = downloadUrl; link.download = result.filename;
    view.append(link); link.click(); link.remove();
  }, "download"); } });
  const actions = document.createElement("div"); actions.className = "cluster";
  actions.append(request, download);
  const note = document.createElement("p");
  note.textContent = "Reviens sur cette page pour consulter ton export.";
  const deletion = document.createElement("section"); deletion.className = "flow";
  const deletionTitle = document.createElement("h2"); deletionTitle.textContent = "Supprimer mon compte";
  const deletionNote = document.createElement("p"); deletionNote.textContent = "La suppression nécessite une confirmation par e-mail. Télécharge ton export avant de confirmer.";
  const deletionStatus = document.createElement("p"); deletionStatus.setAttribute("role", "status");
  const deletionButton = createButton({ label: "Recevoir le lien de suppression", variant: "secondary", onClick: () => { void execute(async () => {
    await service.requestDeletion({ signal: lifetime.signal });
    if (!disposed) deletionStatus.textContent = "La demande est enregistrée. Consulte tes e-mails pour confirmer la suppression.";
  }, "deletion"); } });
  deletion.append(deletionTitle, deletionNote, deletionButton, deletionStatus);
  view.append(heading, explanation, status, feedback, actions, note, deletion);
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); releaseDownload(); archive = null; feedback.replaceChildren(); status.textContent = ""; deletionStatus.textContent = ""; });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void execute(read);
  if (!disposed) refreshOnReturn(view, () => { void execute(read); });
  return view;

  async function read() {
    const request = archive === null ? service.latest({ signal: lifetime.signal }) : service.refresh(archive.id, { signal: lifetime.signal });
    const result = await request;
    if (disposed) return;
    archive = result;
  }
  function releaseDownload() { if (downloadUrl !== null) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; } }
  function render() {
    setButtonLoading(request, busy && operationKind === "request");
    setButtonLoading(download, busy && operationKind === "download");
    setButtonLoading(deletionButton, busy && operationKind === "deletion");
    request.disabled = busy;

    download.disabled = busy;
    deletionButton.disabled = busy;
    download.hidden = archive?.status !== "ready";
    const pendingLabels = { read: "Lecture en cours…", request: "Demande d’export en cours…", download: "Téléchargement de ton archive…", deletion: "Envoi du lien de suppression…" };
    status.textContent = busy ? pendingLabels[operationKind] : archive === null ? "Aucune demande d’export conservée." : StatusLabels[archive.status];
    if (!busy && archive?.expiresAt) status.textContent += " — Fin de disponibilité : " + new Date(archive.expiresAt).toLocaleString("fr-FR");
  }
  /** @param {() => Promise<void>} operation Single view-owned operation.
   * @param {typeof operationKind} [kind] User action announced while waiting. */
  async function execute(operation, kind = "read") {
    if (disposed || busy) return;
    busy = true; operationKind = kind; disposeComponent(feedback); feedback.replaceChildren(); render();
    try { await operation(); }
    catch (error) {
      if (!disposed && !isAbortError(error)) {
        const safe = toUserFacingError(error);
        const details = [];
        if (safe.correlationId) details.push(`Référence : ${safe.correlationId}`);
        if (safe.retryAfterSeconds !== null) details.push(`Réessaie dans ${safe.retryAfterSeconds} seconde(s).`);
        feedback.append(createAlert({ ...safe, variant: "error", detail: details.join(" ") || null }));
        feedback.focus();
      }
    } finally { if (!disposed) { busy = false; render(); } }
  }
}
