import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createBackLink, createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createMemberAvatar } from "../../components/memberAvatar.js";
import { refreshOnReturn } from "../../components/refreshOnReturn.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { readProfilePhoto } from "../profile/profileImageService.js";
import { createGroupAvatar } from "./groupPhoto.js";
import { openGroupShareDialog } from "./groupShareDialog.js";
import { openGroupCreateDialog } from "./groupCreateDialog.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { prependShareDialogIcon } from "../../components/shareDialogIcons.js";

/** @typedef {ReturnType<typeof import("./groupsService.js").createGroupsService>} GroupsService */
/** @typedef {{service:GroupsService,signal:AbortSignal,navigate:(path:string)=>void,apiBaseUrl?:string}} GroupsOptions */

/** @param {GroupsOptions} options Member groups and incoming invitations. @returns {HTMLElement} */
export function createGroupsView({ service, signal, navigate, apiBaseUrl = "" }) {
  const frame = createFrame("Mes groupes", signal);
  const create = createButton({ label: "Créer un groupe", onClick: () => {
    openGroupCreateDialog({ parent: frame.element, trigger: create, service, signal: frame.signal, navigate, onClose: () => { void frame.read(); } });
  } });
  const join = createActionLink({ label: "Rejoindre un groupe", href: "/groups/join" });
  frame.actions.append(join, create);
  let invitePage = 1;
  frame.onRead(async () => {
    const groups = await service.load({ signal: frame.signal });
    let invitations = await service.invitations({ signal: frame.signal, page: invitePage });
    if (invitePage > 1 && !invitations.items.length) {
      invitePage = Math.max(1, invitations.totalPages);
      invitations = await service.invitations({ signal: frame.signal, page: invitePage });
    }
    if (frame.signal.aborted) return;
    frame.clear();
    if (invitations.items.length || invitePage > 1) {
      const section = node("section", "", "group-invitations flow"); section.append(node("h2", "On t’invite !"));
      for (const invitation of invitations.items) {
        const row = node("article", "", "group-invitation");
        const copy = node("div"); copy.append(node("h3", invitation.groupName), node("p", `Organisé par ${invitation.ownerDisplayName}`));
        const actions = node("div", "", "cluster");
        actions.append(createButton({ label: "Accepter", onClick: () => { void frame.run(async () => { await service.accept(invitation.id, { signal: frame.signal }); }); } }),
          createButton({ label: "Refuser", variant: "secondary", onClick: () => { void frame.run(async () => { await service.decline(invitation.id, { signal: frame.signal }); }); } }));
        row.append(copy, actions); section.append(row);
      }
      section.append(pageControls(invitations, page => { invitePage = page; void frame.read(); }));
      frame.content.append(section);
    }
    if (!groups.items.length) {
      const empty = node("div", "", "group-empty flow");
      empty.append(node("h2", "Les envies, c’est encore mieux ensemble."), node("p", "Rassemble ta famille, tes amis ou tes collègues et retrouve leurs listes au même endroit."));
      frame.content.append(empty);
    } else {
      const grid = node("ul", "", "groups-grid"); grid.setAttribute("role", "list");
      for (const group of groups.items) {
        const card = node("li", "", "group-card");
        const label = createActionLink({ label: group.name, href: `/groups/${group.id}` }); label.classList.add("group-card__open");
        label.replaceChildren(createGroupAvatar(group, apiBaseUrl), node("h2", group.name), node("p", `${group.memberCount} membre${group.memberCount > 1 ? "s" : ""}`));
        card.append(label);
        grid.append(card);
      }
      frame.content.append(grid);
    }
  });
  return frame.element;
}

/** @param {GroupsOptions & {groupId:string,memberId:string,apiBaseUrl:string}} options Explicitly scoped group details. @returns {HTMLElement} */
export function createGroupView({ service, groupId, memberId, apiBaseUrl, signal, navigate }) {
  const frame = createFrame("Mon groupe", signal);
  const back = createBackLink({ label: "Retour à Mes groupes", href: "/groups" });
  back.classList.add("group-return");
  const backText = back.querySelector("span"); if (backText) backText.textContent = "Mes groupes";
  frame.element.prepend(back);
  frame.onRead(async () => {
    const { group, etag } = await service.loadOne(groupId, { signal: frame.signal });
    const owner = group.ownerId === memberId;
    const [members, invitations] = await Promise.all([
      service.members(groupId, { signal: frame.signal }), service.sentInvitations(groupId, { signal: frame.signal }),
    ]);
    if (frame.signal.aborted) return;
    frame.clear(); clear(frame.actions); frame.title.textContent = group.name;
    const previousAvatar = frame.title.parentElement?.querySelector(".group-avatar");
    if (previousAvatar instanceof HTMLElement) { disposeComponent(previousAvatar); previousAvatar.remove(); }
    frame.title.before(createGroupAvatar(group, apiBaseUrl));
    document.title = `${group.name} · MonKado`;
    const invite = createButton({ label: "Inviter un proche", variant: "secondary", onClick: () => {
      openGroupShareDialog({ parent: frame.element, trigger: invite, signal: frame.signal, groupId, group, apiBaseUrl, owner, service });
    } });
    invite.setAttribute("aria-label", "Inviter un proche"); invite.title = "Inviter un proche";
    invite.replaceChildren(); prependShareDialogIcon(invite, "share");
    invite.classList.add("group-invite-action", "icon-action");
    if (owner) {
      const edit = createActionLink({ label: "Modifier le groupe", href: `/groups/${groupId}/edit` });
      edit.classList.add("ui-button", "ui-button--secondary");
      applyActionIcon(edit, "edit", "Modifier le groupe");
      const remove = createButton({ label: "Supprimer le groupe", variant: "secondary", onClick: () => openDialog(frame, remove, {
        title: "Supprimer ce groupe ?", description: "Les membres perdront l’accès aux listes partagées dans ce groupe. Les listes et les souhaits seront conservés.", label: "Supprimer", danger: true,
        save: async () => { await service.remove(groupId, { etag, signal: frame.signal }); navigate("/groups"); },
      }) });
      applyActionIcon(remove, "delete", "Supprimer le groupe"); remove.classList.add("icon-action--danger");
      frame.actions.append(edit, invite, remove);
    } else {
      const leave = createButton({ label: "Quitter le groupe", variant: "secondary", onClick: () => openDialog(frame, leave, {
        title: "Quitter ce groupe ?", description: "Tu perdras les accès accordés par ce groupe. Tes listes n’y seront plus partagées.", label: "Quitter", danger: true,
        save: async () => { await service.leave(groupId, { signal: frame.signal }); navigate("/groups"); },
      }) });
      frame.actions.append(leave, invite);
    }
    const people = node("section", "", "group-people flow");
    const roster = node("ul", "", "group-members"); roster.setAttribute("role", "list"); roster.setAttribute("aria-label", "Membres du groupe");
    for (const person of members.items) {
      const row = node("li", "", "group-member");
      const photo = readProfilePhoto(person.profileImageUrl, person.id, apiBaseUrl);
      const profile = createActionLink({ label: person.displayName, href: `/groups/${groupId}/members/${person.id}` }); profile.classList.add("group-member__open");
      profile.setAttribute("aria-label", `Voir les listes de ${person.displayName}`);
      profile.replaceChildren(createMemberAvatar({ memberId: person.id, imageUrl: photo.imageUrl, size: 56 }));
      const text = node("div"); text.append(node("p", person.displayName, "group-member__name"), node("p", `${person.displayName}#${person.displayNameTag}`, "group-member__handle"));
      if (person.id === group.ownerId) text.append(node("span", "Organisateur", "group-card__badge"));
      profile.append(text); row.append(profile);
      if (owner && person.id !== memberId) {
        const remove = createButton({ label: `Retirer ${person.displayName}`, variant: "secondary", onClick: () => openDialog(frame, remove, {
          title: `Retirer ${person.displayName} du groupe ?`, label: "Retirer", danger: true,
          description: "Ses listes ne seront plus partagées ici et cette personne perdra les accès accordés par le groupe.",
          save: async () => { await service.removeMember(groupId, person.id, { signal: frame.signal }); },
        }) });
        applyActionIcon(remove, "delete", `Retirer ${person.displayName} du groupe`);
        remove.classList.add("group-member__remove");
        row.append(remove);
      }
      roster.append(row);
    }
    people.append(node("h2", "Membres"), roster); frame.content.append(people);
    if (invitations?.items.length) {
        const sent = node("section", "", "flow"); sent.append(node("h2", "Invitations en attente"));
        const pending = node("ul", "", "group-pending");
        for (const invitation of invitations.items) {
          const row = node("li", "", "group-invitation");
          row.append(node("span", `${invitation.displayName}#${invitation.displayNameTag}`));
          if (owner) row.append(createButton({ label: `Retirer l’invitation de ${invitation.displayName}`, variant: "secondary", onClick: () => {
            void frame.run(async () => { await service.revoke(groupId, invitation.id, { signal: frame.signal }); });
          } })); pending.append(row);
        }
        sent.append(pending); frame.content.append(sent);
      }
  });
  return frame.element;
}

/** @param {string} title @param {AbortSignal} signal */
function createFrame(title, signal) {
  const element = node("section", "", "groups-view flow");
  const heading = node("h1", title); heading.tabIndex = -1;
  const actions = node("div", "", "cluster");
  const identity = node("div", "", "group-identity"); identity.append(heading);
  const header = node("div", "", "groups-header"); header.append(identity, actions);
  const content = node("div", "", "groups-content flow");
  const feedback = node("div"); feedback.setAttribute("role", "status");
  element.append(header, feedback, content);
  const lifetime = new AbortController(); const combined = AbortSignal.any([signal, lifetime.signal]);
  let busy = false, blocked = false, disposed = false;
  /** @type {()=>Promise<void>} */ let render = async () => {};
  registerComponentCleanup(element, () => { disposed = true; lifetime.abort(); clear(content); clear(feedback); });
  addComponentEventListener(element, signal, "abort", () => disposeComponent(element), { once: true });
  refreshOnReturn(element, () => { if (!element.querySelector("dialog[open]") && ![...element.querySelectorAll("input")].some(input => input.value.trim())) void read(); });
  const frame = { element, actions, content, title: heading, signal: combined, read, run, clear: () => clear(content),
    /** @param {()=>Promise<void>} callback */ onRead(callback) { render = callback; if (combined.aborted) disposeComponent(element); else void read(); } };
  return frame;
  async function read() {
    if (busy || disposed || combined.aborted) return;
    busy = true; controls(true); clear(feedback); clear(content); content.append(createLoadingState({ label: "Chargement du groupe…" }));
    try { await render(); if (!combined.aborted) blocked = false; }
    catch (error) {
      if (isAbortError(error) || combined.aborted) return;
      clear(content); show(error); blocked = true;
    } finally { busy = false; if (!disposed) controls(false); }
  }
  /** @param {()=>Promise<void>} mutation */
  async function run(mutation) {
    if (busy || blocked || disposed || combined.aborted) return;
    busy = true; controls(true); clear(feedback);
    try { await mutation(); if (combined.aborted) return; busy = false; await read(); if (!disposed) heading.focus(); }
    catch (error) { if (!isAbortError(error) && !combined.aborted) { blocked = true; show(error, true); } }
    finally { busy = false; if (!disposed) controls(false); }
  }
  /** @param {unknown} error @param {boolean} [mutation] */
  function show(error, mutation = false) {
    clear(feedback); feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
    if (mutation) feedback.append(node("p", "Vérifie l’état du groupe avant de recommencer."));
    feedback.append(createButton({ label: mutation ? "Vérifier le groupe" : "Réessayer", variant: "secondary", onClick: () => { void read(); } }));
  }
  /** @param {boolean} loading */
  function controls(loading) {
    element.setAttribute("aria-busy", String(loading));
    for (const button of element.querySelectorAll("button")) {
      if (loading) { if (!button.disabled) button.dataset.groupBusy = "true"; button.disabled = true; }
      else if (button.dataset.groupBusy === "true") { button.disabled = false; delete button.dataset.groupBusy; }
    }
  }
}

/** @typedef {ReturnType<typeof createFrame>} GroupFrame */
/** @param {GroupFrame} frame @param {HTMLButtonElement} trigger
 * @param {{title:string,label:string,description?:string,name?:string,danger?:boolean,save:(name:string)=>Promise<void>}} options */
function openDialog(frame, trigger, { title, label, description, name, danger = false, save }) {
  const dialog = node("dialog", "", "group-dialog flow");
  const heading = node("h2", title); heading.id = `group-dialog-${crypto.randomUUID()}`; heading.tabIndex = -1; dialog.setAttribute("aria-labelledby", heading.id);
  const form = node("form", "", "flow"); const input = document.createElement("input"); input.type = "text"; input.maxLength = 100; input.required = true; input.value = name ?? "";
  const feedback = node("div"); feedback.setAttribute("role", "alert");
  if (description) form.append(node("p", description));
  if (name !== undefined) form.append(createFormField({ label: "Nom du groupe", control: input, required: true }));
  const actions = node("div", "", "cluster");
  let pending = false, blocked = false;
  const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: close });
  const submit = createButton({ label, variant: danger ? "danger" : "primary", type: "submit" }); actions.append(cancel, submit);
  form.append(feedback, actions); dialog.append(heading, form);
  addComponentEventListener(dialog, form, "submit", event => { event.preventDefault(); void commit(); });
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); close(); });
  addComponentEventListener(dialog, dialog, "close", close);
  registerComponentCleanup(dialog, () => { if (dialog.open) dialog.close(); dialog.remove(); });
  frame.element.append(dialog); dialog.showModal(); if (name !== undefined) input.focus(); else heading.focus();
  function close() { if (pending) return; disposeComponent(dialog); if (trigger.isConnected) trigger.focus(); if (blocked) void frame.read(); }
  async function commit() {
    if (pending || blocked || frame.signal.aborted) return;
    if (name !== undefined && !input.value.trim()) { input.setCustomValidity("Nom du groupe obligatoire."); input.reportValidity(); return; }
    input.setCustomValidity(""); pending = true; submit.disabled = cancel.disabled = input.disabled = true; clear(feedback);
    try { await save(input.value); pending = false; close(); if (!frame.signal.aborted) await frame.read(); }
    catch (error) {
      if (frame.signal.aborted || isAbortError(error)) return;
      feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
      blocked = !(error instanceof ApiError && error.kind === "http" && error.statusCode !== null && [400,403,409].includes(error.statusCode));
      if (blocked) feedback.append(node("p", "Ferme cette fenêtre pour vérifier l’état du groupe avant de recommencer."));
    } finally { pending = false; cancel.disabled = false; submit.disabled = blocked; input.disabled = false; }
  }
  addComponentEventListener(dialog, input, "input", () => input.setCustomValidity(""));
}

/** @param {{totalPages:number,currentPage:number}} page @param {(page:number)=>void} onPage */
function pageControls(page, onPage) {
  const nav = node("nav", "", "cluster"); nav.setAttribute("aria-label", "Pagination"); nav.hidden = page.totalPages < 2;
  const previous = createButton({ label: "Précédente", variant: "secondary", onClick: () => onPage(page.currentPage - 1) }); previous.disabled = page.currentPage <= 1;
  const next = createButton({ label: "Suivante", variant: "secondary", onClick: () => onPage(page.currentPage + 1) }); next.disabled = page.currentPage >= page.totalPages;
  nav.append(previous, next); return nav;
}
/** @param {HTMLElement} element */
function clear(element) { disposeComponent(element); element.replaceChildren(); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag @param {string} [text] @param {string} [className] @returns {HTMLElementTagNameMap[T]} */
function node(tag, text = "", className = "") { const element = document.createElement(tag); element.textContent = text; element.className = className; return element; }
