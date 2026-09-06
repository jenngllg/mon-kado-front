import { createAbortError } from "../api/apiError.js";

/** Waits independently without cancelling shared cookie mutations.
 * @template T
 * @param {Promise<T>} work Shared work.
 * @param {AbortSignal} [signal] Caller cancellation.
 * @returns {Promise<T>} Independent waiter.
 */
export function waitForSession(work, signal) {
  if (signal === undefined) return work;
  if (signal.aborted) {
    void work.catch(() => {});
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const abort = () => reject(createAbortError());
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
