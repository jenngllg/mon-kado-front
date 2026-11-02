import { ApiError, createAbortError, isAbortError } from "../../api/apiError.js";

/** @typedef {{id:string,name:string,groupName:string,href:string,service:Pick<ReturnType<typeof import("./groupSuggestionsService.js").createGroupSuggestionsService>,"create"|"uploadImage">}} SuggestionDestination */
/** @typedef {{destination:SuggestionDestination,state:"saved"|"imageUnconfirmed"|"refused"|"uncertain"|"notSent"}} SuggestionOutcome */

/** Tracks each destination independently so partial and uncertain writes cannot be replayed.
 * @returns {{run:(targets:SuggestionDestination[],values:import("./groupSuggestionsService.js").SuggestionValues,image:Blob|null,signal:AbortSignal)=>Promise<{outcomes:SuggestionOutcome[],complete:boolean,uncertain:boolean,retryable:boolean}>,hasConfirmed:()=>boolean}}
 */
export function createGroupSuggestionBatch() {
  /** @type {Map<string,SuggestionOutcome>} */ const outcomes = new Map();
  let running = false;
  const confirmed = () => [...outcomes.values()].some(item => ["saved", "imageUnconfirmed"].includes(item.state));
  /** @param {SuggestionDestination[]} targets */
  const summary = targets => ({ outcomes: targets.map(destination => outcomes.get(destination.id) ?? /** @type {SuggestionOutcome} */ ({ destination, state: "notSent" })),
    complete: targets.length > 0 && targets.every(target => ["saved", "imageUnconfirmed"].includes(outcomes.get(target.id)?.state ?? "")),
    uncertain: [...outcomes.values()].some(item => item.state === "uncertain"),
    retryable: targets.some(target => !outcomes.has(target.id) || outcomes.get(target.id)?.state === "refused") });
  return { hasConfirmed: confirmed, async run(targets, values, image, signal) {
    if (signal.aborted) throw createAbortError();
    if (running || summary(targets).uncertain) return summary(targets);
    running = true;
    try {
      for (const target of targets) {
        if (signal.aborted) throw createAbortError();
        if (["saved", "imageUnconfirmed"].includes(outcomes.get(target.id)?.state ?? "")) continue;
        try {
          const result = await target.service.create(values, signal);
          outcomes.set(target.id, { destination: target, state: "saved" });
          if (image) {
            try { await target.service.uploadImage(result.id, image, result.entityTag, signal); }
            catch (error) { outcomes.set(target.id, { destination: target, state: "imageUnconfirmed" }); if (isAbortError(error)) throw error; }
          }
        } catch (error) {
          if (signal.aborted || isAbortError(error)) throw error;
          const refused = error instanceof ApiError && error.kind === "http" && error.statusCode !== null && error.statusCode >= 400 && error.statusCode < 500;
          outcomes.set(target.id, { destination: target, state: refused ? "refused" : "uncertain" });
          if (!refused || error instanceof ApiError && error.statusCode === 401) break;
        }
      }
      return summary(targets);
    } finally { running = false; }
  } };
}
