import { isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createBackLink, createButton, createFormField, createLoadingState, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createGroupInvitationPreview } from "./groupInvitationPreview.js";
import { ApiError } from "../../api/apiError.js";
import { normalizeGroupCode } from "./groupsService.js";

/** Redeems an in-memory fragment or typed code only on an explicit authenticated submission.
 * @param {{session:Pick<import("../../auth/sessionManager.js").SessionManager,"getSnapshot"|"subscribe"|"restore">,
 * service:Pick<ReturnType<typeof import("./groupsService.js").createGroupsService>,"join"|"previewJoin"|"previewInvitation">,
 * apiBaseUrl:string,groupId?:string,code?:string,signal:AbortSignal,navigate:(path:string)=>void}} options Admission dependencies.
 */
export function createGroupJoinView({ session, service, apiBaseUrl, groupId, code = "", signal, navigate }) {
  const view = node("section", ""); view.className = "group-join-view flow";
  const form = document.createElement("form"); form.className = "flow"; form.noValidate = true;
  const input = document.createElement("input"); input.value = normalizeGroupCode(code.replace(/^#/, "")) ?? "";
  input.maxLength = 32; input.autocomplete = "off"; input.spellcheck = false; input.setAttribute("autocapitalize", "characters");
  const field = createFormField({ label: "Code du groupe", control: input, required: true });
  const submit = createButton({ label: "Voir le groupe", type: "submit" });
  const preview = node("div", ""); preview.setAttribute("aria-live", "polite");
  const access = node("div", ""); access.className = "flow";
  const feedback = node("div", ""); feedback.setAttribute("role", "status");
  const signIn = createActionLink({ label: "Se connecter", href: "/login" });
  const register = createActionLink({ label: "Créer un compte", href: "/register" });
  // Keep the admission code in this tab, never in authentication URLs or storage.
  for (const link of [signIn, register]) { link.target = "_blank"; link.rel = "noopener noreferrer"; link.setAttribute("aria-label", `${link.textContent} (nouvel onglet)`); }
  const accountActions = node("div", ""); accountActions.className = "cluster"; accountActions.append(signIn, register);
  const restore = createButton({ label: "Je suis connecté", variant: "secondary", onClick: () => { void session.restore().catch(error => { if (!disposed) feedback.replaceChildren(createAlert({ ...toUserFacingError(error), variant: "error" })); }); } });
  const accountCopy = node("p", "Connecte-toi dans le nouvel onglet, puis reviens ici pour rejoindre le groupe.");
  access.append(accountCopy, accountActions, restore);
  form.append(field, submit);
  view.append(createBackLink({ label: "Retour à Mes groupes", href: "/groups" }), node("h1", "Rejoindre un groupe"), preview, node("p", "Utilise le code reçu ou celui du lien. Aucune validation de l’organisateur n’est nécessaire."), access, form, feedback);
  const lifetime = new AbortController(); let identity = new AbortController();
  let disposed = false, pending = false, actor = "", verifiedCode = "";
  let previewRequest = new AbortController();
  const sync = () => {
    input.disabled = pending;
    submit.disabled = pending || (!!verifiedCode && !actor);
    const label = submit.querySelector(".ui-button__label");
    if (label) label.textContent = verifiedCode ? "Rejoindre le groupe" : "Voir le groupe";
    form.setAttribute("aria-busy", String(pending));
  };
  function clearPreview() {
    previewRequest.abort(); previewRequest = new AbortController(); verifiedCode = "";
    disposeComponent(preview); preview.replaceChildren(); sync();
  }
  const update = (/** @type {import("../../auth/sessionManager.js").SessionSnapshot} */ state) => {
    if (disposed) return;
    const next = state.status === "authenticated" && !state.authenticationPending && !state.logoutPending ? state.user?.id ?? "" : "";
    if (next !== actor) {
      identity.abort(); identity = new AbortController();
      if (actor) { pending = false; input.value = ""; clearPreview(); disposeComponent(feedback); feedback.replaceChildren(); }
      actor = next;
    }
    access.hidden = !!actor; sync();
    accountCopy.textContent = state.status === "unavailable" ? "La session n’a pas pu être vérifiée." : "Connecte-toi dans le nouvel onglet, puis reviens ici pour rejoindre le groupe.";
  };
  addComponentEventListener(view, form, "submit", event => { event.preventDefault(); void join(); });
  addComponentEventListener(view, input, "input", () => { setFormFieldValidation(field, null); clearPreview(); disposeComponent(feedback); feedback.replaceChildren(); });
  registerComponentCleanup(view, session.subscribe(update));
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); identity.abort(); previewRequest.abort(); input.value = ""; actor = ""; });
  addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
  if (signal.aborted) disposeComponent(view); else { update(session.getSnapshot()); if (input.value || groupId) void loadPreview(); }
  return view;
  async function loadPreview() {
    const normalized = normalizeGroupCode(input.value);
    if ((!normalized && !groupId) || disposed || pending) return;
    clearPreview(); pending = true; sync();
    const requestSignal = AbortSignal.any([signal, lifetime.signal, previewRequest.signal]);
    preview.append(createLoadingState({ label: "Chargement du groupe…" }));
    disposeComponent(feedback); feedback.replaceChildren();
    try {
      const group = normalized ? await service.previewJoin(normalized, { signal: requestSignal }) : await service.previewInvitation(/** @type {string} */ (groupId), { signal: requestSignal });
      if (requestSignal.aborted) return;
      if (groupId && group.id !== groupId) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "GROUP_JOIN_LINK_NOT_FOUND" });
      disposeComponent(preview); preview.replaceChildren(createGroupInvitationPreview(group, apiBaseUrl, "h2"));
      verifiedCode = normalized ?? "";
      document.title = `${group.name} · MonKado`;
    } catch (error) {
      if (!requestSignal.aborted && !isAbortError(error)) {
        disposeComponent(preview); preview.replaceChildren();
        feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
      }
    } finally { if (!disposed && !requestSignal.aborted) { pending = false; sync(); } }
  }
  async function join() {
    if (pending || disposed) return;
    const normalized = normalizeGroupCode(input.value);
    if (!normalized) { setFormFieldValidation(field, "Vérifie le code du groupe."); input.focus(); return; }
    if (normalized !== verifiedCode) { await loadPreview(); return; }
    if (!actor) return;
    const requestSignal = AbortSignal.any([signal, lifetime.signal, identity.signal]);
    pending = true; input.disabled = submit.disabled = true; form.setAttribute("aria-busy", "true"); disposeComponent(feedback); feedback.replaceChildren();
    try {
      const group = await service.join(normalized, { signal: requestSignal });
      if (!requestSignal.aborted) { input.value = ""; navigate(`/groups/${group.id}`); }
    } catch (error) { if (!requestSignal.aborted && !isAbortError(error)) feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" })); }
    finally { if (!disposed && !requestSignal.aborted) { pending = false; sync(); } }
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag @param {string} copy */
function node(tag, copy) { const element = document.createElement(tag); element.textContent = copy; return element; }
