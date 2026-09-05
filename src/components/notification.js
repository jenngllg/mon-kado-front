import { createButton } from "./button.js";
import {
  assertNonEmptyText,
  assertVariant,
} from "./componentHelpers.js";
import {
  addComponentEventListener,
  disposeComponent,
  registerComponentCleanup,
} from "./componentLifecycle.js";

const NotificationVariants = new Set([
  "info",
  "success",
  "warning",
  "error",
]);
const NotificationRegions = new WeakSet();

/** @type {WeakMap<HTMLElement, NotificationState>} */
const NotificationStates = new WeakMap();

/**
 * @typedef {"info" | "success" | "warning" | "error"} NotificationVariant
 */

/**
 * @typedef {{
 *   dismissed: boolean,
 *   durationMilliseconds: number | null,
 *   remainingMilliseconds: number | null,
 *   startedAt: number,
 *   timerIdentifier: number | null,
 *   pauseReasons: Set<string>,
 *   onDismiss: (() => void) | null
 * }} NotificationState
 */

/**
 * Creates the container used to stack notifications.
 *
 * @param {{ label?: string }} [options] Region options.
 * @returns {HTMLElement} Notification region.
 */
export function createNotificationRegion({ label = "Notifications" } = {}) {
  assertNonEmptyText(label, "label");

  const region = document.createElement("aside");
  region.className = "notification-region";
  region.setAttribute("aria-label", label);
  region.setAttribute("aria-relevant", "additions");
  NotificationRegions.add(region);

  return region;
}

/**
 * Adds a notification to a notification region.
 *
 * @param {HTMLElement} region Region created by createNotificationRegion.
 * @param {{
 *   message: string,
 *   title?: string | null,
 *   variant?: NotificationVariant,
 *   durationMilliseconds?: number | null,
 *   onDismiss?: (() => void) | null
 * }} options Notification options.
 * @returns {HTMLElement} Notification element.
 */
export function showNotification(
  region,
  {
    message,
    title = null,
    variant = "info",
    durationMilliseconds = getDefaultDuration(variant),
    onDismiss = null,
  },
) {
  if (!NotificationRegions.has(region)) {
    throw new TypeError(
      "The notification region was not created by createNotificationRegion.",
    );
  }

  assertNonEmptyText(message, "message");
  assertVariant(variant, NotificationVariants, "notification");
  assertDuration(durationMilliseconds);

  const notification = document.createElement("article");
  notification.className = `notification notification--${variant}`;
  notification.setAttribute("role", variant === "error" ? "alert" : "status");

  const content = document.createElement("div");
  content.className = "notification__content flow";

  if (title !== null) {
    const heading = document.createElement("h2");
    heading.className = "notification__title";
    heading.textContent = title;
    content.append(heading);
  }

  const description = document.createElement("p");
  description.className = "notification__message";
  description.textContent = message;
  content.append(description);

  const closeButton = createButton({
    label: "Fermer",
    variant: "ghost",
    onClick: () => dismissNotification(notification),
  });
  closeButton.classList.add("notification__close");
  closeButton.setAttribute("aria-label", "Fermer la notification");
  notification.append(content, closeButton);

  const state = createNotificationState(durationMilliseconds, onDismiss);
  NotificationStates.set(notification, state);
  registerComponentCleanup(
    notification,
    () => clearNotificationTimer(state),
  );
  registerPauseInteractions(notification, state);
  region.append(notification);
  scheduleDismissal(notification, state);

  return notification;
}

/**
 * Dismisses a notification and releases all resources it owns.
 *
 * @param {HTMLElement} notification Notification returned by showNotification.
 */
export function dismissNotification(notification) {
  const state = NotificationStates.get(notification);

  if (state === undefined) {
    throw new TypeError("The element is not a notification.");
  }

  if (state.dismissed) {
    return;
  }

  state.dismissed = true;
  disposeComponent(notification);
  notification.remove();
  state.onDismiss?.();
}

/**
 * @param {number | null} durationMilliseconds Dismissal duration.
 * @param {(() => void) | null} onDismiss Dismiss callback.
 * @returns {NotificationState} Mutable notification state.
 */
function createNotificationState(durationMilliseconds, onDismiss) {
  return {
    dismissed: false,
    durationMilliseconds,
    remainingMilliseconds: durationMilliseconds,
    startedAt: 0,
    timerIdentifier: null,
    pauseReasons: new Set(),
    onDismiss,
  };
}

/**
 * @param {HTMLElement} notification Notification element.
 * @param {NotificationState} state Notification state.
 */
function registerPauseInteractions(notification, state) {
  addComponentEventListener(
    notification,
    notification,
    "pointerenter",
    () => pauseDismissal(state, "pointer"),
  );
  addComponentEventListener(
    notification,
    notification,
    "pointerleave",
    () => resumeDismissal(notification, state, "pointer"),
  );
  addComponentEventListener(
    notification,
    notification,
    "focusin",
    () => pauseDismissal(state, "focus"),
  );
  addComponentEventListener(
    notification,
    notification,
    "focusout",
    (event) => {
      const focusEvent = /** @type {FocusEvent} */ (event);

      if (
        focusEvent.relatedTarget instanceof Node &&
        notification.contains(focusEvent.relatedTarget)
      ) {
        return;
      }

      resumeDismissal(notification, state, "focus");
    },
  );
}

/**
 * @param {HTMLElement} notification Notification element.
 * @param {NotificationState} state Notification state.
 */
function scheduleDismissal(notification, state) {
  if (
    state.remainingMilliseconds === null ||
    state.pauseReasons.size > 0 ||
    state.dismissed
  ) {
    return;
  }

  state.startedAt = Date.now();
  state.timerIdentifier = window.setTimeout(
    () => dismissNotification(notification),
    state.remainingMilliseconds,
  );
}

/**
 * @param {NotificationState} state Notification state.
 * @param {string} reason Pause reason.
 */
function pauseDismissal(state, reason) {
  if (state.pauseReasons.has(reason) || state.dismissed) {
    return;
  }

  state.pauseReasons.add(reason);

  if (
    state.timerIdentifier === null ||
    state.remainingMilliseconds === null
  ) {
    return;
  }

  const elapsed = Date.now() - state.startedAt;
  state.remainingMilliseconds = Math.max(
    0,
    state.remainingMilliseconds - elapsed,
  );
  clearNotificationTimer(state);
}

/**
 * @param {HTMLElement} notification Notification element.
 * @param {NotificationState} state Notification state.
 * @param {string} reason Pause reason.
 */
function resumeDismissal(notification, state, reason) {
  if (!state.pauseReasons.delete(reason)) {
    return;
  }

  scheduleDismissal(notification, state);
}

/**
 * @param {NotificationState} state Notification state.
 */
function clearNotificationTimer(state) {
  if (state.timerIdentifier === null) {
    return;
  }

  window.clearTimeout(state.timerIdentifier);
  state.timerIdentifier = null;
}

/**
 * @param {NotificationVariant} variant Notification variant.
 * @returns {number | null} Default duration.
 */
function getDefaultDuration(variant) {
  if (variant === "error") {
    return null;
  }

  if (variant === "warning") {
    return 8_000;
  }

  return 5_000;
}

/**
 * @param {number | null} durationMilliseconds Dismissal duration.
 */
function assertDuration(durationMilliseconds) {
  if (durationMilliseconds === null) {
    return;
  }

  if (
    !Number.isFinite(durationMilliseconds) ||
    durationMilliseconds < 0
  ) {
    throw new RangeError(
      "durationMilliseconds must be a non-negative number or null.",
    );
  }
}
