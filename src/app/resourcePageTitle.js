/** Keeps the active tab title in sync with the resource returned by an existing read.
 * @template {unknown[]} TArgs
 * @template TResult
 * @param {(...args: TArgs) => Promise<TResult>} load Existing resource reader.
 * @param {Pick<import("../router/router.js").RouteContext, "signal" | "setTitle">} context Active navigation.
 * @param {(result: TResult) => string} getName Resource name selector.
 * @returns {(...args: TArgs) => Promise<TResult>} Reader preserving its result and arguments.
 */
export function withResourcePageTitle(load, context, getName) {
  return async (...args) => {
    const result = await load(...args);
    if (!context.signal.aborted) context.setTitle?.(`${getName(result)} · MonKado`);
    return result;
  };
}
