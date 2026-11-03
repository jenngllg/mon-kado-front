import { ApiError, isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { NotificationPreferenceOptions, equalNotificationPreferences } from "./notificationPreferencesService.js";
import "../../styles/notificationPreferences.css";

/** @typedef {import("./notificationPreferencesService.js").NotificationPreferences} Settings */
/** @typedef {import("./notificationPreferencesService.js").PreferenceSnapshot} Snapshot */

/** Creates the member-private account editor without background refreshes or write replays.
 * @param {{service: ReturnType<typeof import("./notificationPreferencesService.js").createNotificationPreferencesService>,signal?:AbortSignal}} options View-owned operations.
 * @returns {HTMLElement} Disposable account content.
 */
export function createNotificationPreferencesView({service,signal}) {
  const view = node("section", "");
  view.className = "notification-preferences-view flow";
  const title = node("h1", "Mes notifications");
  const hint = node("p", "Ces réglages concernent les nouvelles notifications de la cloche.");
  const feedback = node("div", "");
  feedback.tabIndex = -1;
  const status = node("p", "");
  status.setAttribute("role", "status");
  status.hidden = true;
  const loading = createLoadingState({ label: "Chargement des préférences…" });
  const form = node("form", "");
  form.className = "profile-form notification-preferences-form flow";
  form.hidden = true;
  form.setAttribute("aria-label", "Préférences de notification");
  const choices = node("div", "");
  choices.className = "notification-preferences__choices";
  choices.setAttribute("role", "group");
  choices.setAttribute("aria-label", "Types de notification");
  /** @type {Map<keyof Settings, HTMLInputElement>} */
  const inputs = new Map();
  for (const option of NotificationPreferenceOptions) {
    const key = /** @type {keyof Settings} */ (option.key);
    const input = node("input", "");
    input.type = "checkbox";
    input.name = key;
    input.setAttribute("role", "switch");
    const label = node("label", "");
    label.className = "profile-visibility__label cluster notification-preferences__option";
    const text = node("span", "");
    text.className = "notification-preferences__label";
    const caption = node("span", option.label);
    caption.id = `notification-preference-${key}-label-${crypto.randomUUID()}`;
    input.setAttribute("aria-labelledby", caption.id);
    text.append(caption);
    if (option.detail) {
      const detail = node("small", option.detail);
      detail.className = "muted";
      detail.id = `notification-preference-${key}-${crypto.randomUUID()}`;
      input.setAttribute("aria-describedby", detail.id);
      text.append(detail);
    }
    label.append(input, text);
    choices.append(label);
    inputs.set(key, input);
  }
  const submit = createButton({ label: "Enregistrer", type: "submit" });
  const actions = node("div", "");
  actions.className = "cluster";
  actions.append(submit);
  form.append(choices, actions);
  view.append(title, hint, loading, feedback, status, form);
  const lifetime = new AbortController();
  let disposed = false, busy = false, needsRead = false;
  /** @type {Snapshot|null} */
  let base = null;
  const active = () => !disposed && !lifetime.signal.aborted;

  function clearFeedback() {
    disposeComponent(feedback);
    feedback.replaceChildren();
    status.hidden = true;
  }
  /** @returns {Settings} A detached draft. */
  function draft() {
    return /** @type {Settings} */ (Object.fromEntries([...inputs].map(([key, input]) => [key, input.checked])));
  }
  function controls() {
    for (const input of inputs.values()) input.disabled = busy || base === null;
    submit.disabled = busy || base === null || equalNotificationPreferences(draft(), base.settings);
    form.setAttribute("aria-busy", String(busy));
    setButtonLoading(submit, busy);
  }
  /** @param {Snapshot} saved Current confirmed server state. */
  function accept(saved) {
    base = saved;
    needsRead = false;
    for (const [key, input] of inputs) input.checked = saved.settings[key];
    status.textContent = "Préférences enregistrées.";
    status.hidden = false;
  }
  /** @param {unknown} error Current failure. */
  function showError(error) {
    feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
  }
  /** Merge only this form's changed booleans; unrelated concurrent edits are retained.
   * @param {Settings} intended @param {Settings} original @param {Settings} remote @returns {Settings} Safe complete update.
   */
  function merge(intended, original, remote) {
    const result = { ...remote };
    for (const key of inputs.keys()) {
      if (intended[key] !== original[key]) result[key] = intended[key];
    }
    return result;
  }

  async function save() {
    if (!active() || busy || base === null) return;
    const original = base;
    let intended = draft();
    busy = true;
    clearFeedback();
    controls();
    try {
      let current = original;
      if (needsRead) {
        current = await service.load(lifetime.signal);
        if (!active()) return;
        intended = merge(intended, original.settings, current.settings);
        if (equalNotificationPreferences(intended, current.settings)) {
          accept(current);
          return;
        }
      }
      let saved;
      try {
        saved = await service.save(intended, current.etag, lifetime.signal);
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 412) throw error;
        current = await service.load(lifetime.signal);
        if (!active()) return;
        intended = merge(intended, original.settings, current.settings);
        saved = equalNotificationPreferences(intended, current.settings)
          ? current : await service.save(intended, current.etag, lifetime.signal);
      }
      if (active()) accept(saved);
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      const uncertain = !(error instanceof ApiError) || error.kind !== "http" || error.statusCode === null || error.statusCode >= 500;
      if (uncertain) {
        needsRead = true;
        try {
          const current = await service.load(lifetime.signal);
          if (!active()) return;
          if (equalNotificationPreferences(current.settings, intended)) {
            accept(current);
            return;
          }
        } catch (readError) {
          if (!active() || isAbortError(readError)) return;
        }
      }
      if (active()) showError(error);
    } finally {
      if (active()) {
        busy = false;
        controls();
      }
    }
  }
  addComponentEventListener(form, form, "submit", event => {
    event.preventDefault();
    void save();
  });
  addComponentEventListener(form, form, "change", () => {
    if (!active() || busy) return;
    clearFeedback();
    controls();
  });
  registerComponentCleanup(view, () => {
    disposed = true;
    lifetime.abort();
  });
  if (signal) {
    if (signal.aborted) {
      disposeComponent(view);
      return view;
    }
    const abort = () => disposeComponent(view);
    signal.addEventListener("abort", abort, { once: true });
    registerComponentCleanup(view, () => signal.removeEventListener("abort", abort));
  }
  void (async () => {
    try {
      const value = await service.load(lifetime.signal);
      if (!active()) return;
      base = value;
      for (const [key, input] of inputs) input.checked = value.settings[key];
      loading.remove();
      form.hidden = false;
      controls();
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      loading.remove();
      showError(error);
    }
  })();
  return view;
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag @param {string} text @returns {HTMLElementTagNameMap[T]} Text-only element. */
function node(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}
