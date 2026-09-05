/** @type {WeakMap<HTMLElement, Set<() => void>>} */
const CleanupRegistry = new WeakMap();

/**
 * Registers a cleanup callback owned by a component.
 *
 * @param {HTMLElement} element Component root.
 * @param {() => void} cleanup Cleanup callback.
 */
export function registerComponentCleanup(element, cleanup) {
  const cleanups = CleanupRegistry.get(element) ?? new Set();
  cleanups.add(cleanup);
  CleanupRegistry.set(element, cleanups);
}

/**
 * Adds an event listener that is removed with its owning component.
 *
 * @param {HTMLElement} owner Component owning the listener.
 * @param {EventTarget} target Event target.
 * @param {string} type Event type.
 * @param {EventListenerOrEventListenerObject} listener Event listener.
 * @param {boolean | AddEventListenerOptions} [options] Listener options.
 */
export function addComponentEventListener(
  owner,
  target,
  type,
  listener,
  options,
) {
  target.addEventListener(type, listener, options);
  registerComponentCleanup(
    owner,
    () => target.removeEventListener(type, listener, options),
  );
}

/**
 * Releases listeners, timers and nested component resources without removing
 * the element from the DOM.
 *
 * @param {HTMLElement} element Component root.
 */
export function disposeComponent(element) {
  const descendants = [...element.querySelectorAll("*")].reverse();

  for (const descendant of descendants) {
    if (descendant instanceof HTMLElement) {
      runCleanups(descendant);
    }
  }

  runCleanups(element);
}

/**
 * @param {HTMLElement} element Component root.
 */
function runCleanups(element) {
  const cleanups = CleanupRegistry.get(element);

  if (cleanups === undefined) {
    return;
  }

  CleanupRegistry.delete(element);

  for (const cleanup of cleanups) {
    cleanup();
  }
}
