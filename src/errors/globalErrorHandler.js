import { isAbortError } from "../api/apiError.js";
import { toUserFacingError } from "./errorMessages.js";

/**
 * Installs global browser error handlers.
 *
 * @param {{
 *   target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
 *   presentError: (error: import("./errorMessages.js").UserFacingError) => void
 * }} options Global handler dependencies.
 * @returns {() => void} Function removing both listeners.
 */
export function installGlobalErrorHandlers({ target, presentError }) {
  /** @param {Event} event */
  const handleError = (event) => {
    const error = getEventValue(event, "error") ??
      new Error("An unexpected browser error occurred.");
    presentUnlessAborted(error, presentError);
  };
  /** @param {Event} event */
  const handleUnhandledRejection = (event) => {
    const error = getEventValue(event, "reason") ??
      new Error("An unexpected promise rejection occurred.");
    presentUnlessAborted(error, presentError);
  };

  target.addEventListener("error", handleError);
  target.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    target.removeEventListener("error", handleError);
    target.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
}

/**
 * @param {Event} event Browser event.
 * @param {"error" | "reason"} property Event property to read.
 * @returns {unknown} Event value when present.
 */
function getEventValue(event, property) {
  if (property in event) {
    const eventWithDetails = /** @type {Event & { error?: unknown, reason?: unknown }} */ (event);

    return eventWithDetails[property];
  }

  return null;
}

/**
 * @param {unknown} error Failure to handle.
 * @param {(error: import("./errorMessages.js").UserFacingError) => void} presentError Presenter.
 */
function presentUnlessAborted(error, presentError) {
  if (isAbortError(error)) {
    return;
  }

  presentError(toUserFacingError(error));
}
