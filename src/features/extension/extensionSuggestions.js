import { ApiError, createAbortError } from "../../api/apiError.js";
import { createGroupsService } from "../groups/groupsService.js";
import { createGroupSuggestionsService } from "../groups/groupSuggestionsService.js";

/** Reads every authorized page without retaining partial results after a failure.
 * @template T
 * @param {(page:number)=>Promise<import("../groups/groupsService.js").Page<T>>} load Page reader.
 */
async function readAll(load) {
  const items = [];
  let page = 1;
  while (true) {
    const result = await load(page);
    items.push(...result.items);
    if (!result.hasNextPage) return items;
    page++;
  }
}

/** Keeps group authorization identifiers inside the signed-in site tab.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager,"request">} session Existing session.
 */
export function createExtensionSuggestions(session) {
  const groups = createGroupsService(session);
  /** @type {Map<string,{memberId:string,name:string,groups:import("../groups/groupsService.js").Group[]}>} */
  const recipients = new Map();
  /** @type {Map<string,{groupId:string,wishlistId:string}>} */
  const destinations = new Map();
  let account = "";
  /** @param {string} memberId Current session identity. */
  function identity(memberId) {
    if (account !== memberId) { recipients.clear(); destinations.clear(); account = memberId; }
  }
  /** @param {unknown} id Opaque tab-local destination. */
  function destination(id) {
    const value = typeof id === "string" ? destinations.get(id) : undefined;
    if (!value) throw new ApiError({ kind: "http", statusCode: 404 });
    return value;
  }
  return {
    /** @param {string} memberId @param {AbortSignal} signal */
    async recipients(memberId, signal) {
      identity(memberId);
      const collection = await readAll(page => groups.load({ page, signal }));
      /** @type {Map<string,{memberId:string,name:string,groups:import("../groups/groupsService.js").Group[]}>} */
      const people = new Map();
      for (const group of collection) {
        let members;
        try { members = await readAll(page => groups.members(group.id, { page, signal })); }
        catch (error) { if (error instanceof ApiError && error.statusCode === 404) continue; throw error; }
        for (const member of members) {
          if (member.id === memberId) continue;
          const person = people.get(member.id) ?? { memberId: member.id, name: `${member.displayName}#${member.displayNameTag}`, groups: [] };
          person.groups.push(group); people.set(member.id, person);
        }
      }
      if (account !== memberId || signal.aborted) throw createAbortError();
      recipients.clear(); destinations.clear();
      return [...people.values()].sort((left, right) => left.name.localeCompare(right.name, "fr")).map(person => {
        const id = crypto.randomUUID(); recipients.set(id, person); return { id, name: person.name };
      });
    },
    /** @param {string} memberId @param {unknown} recipientId @param {AbortSignal} signal */
    async lists(memberId, recipientId, signal) {
      identity(memberId);
      const person = typeof recipientId === "string" ? recipients.get(recipientId) : undefined;
      if (!person) throw new ApiError({ kind: "http", statusCode: 404 });
      const result = [];
      for (const group of person.groups) {
        let lists;
        try { lists = await readAll(page => groups.wishlists(group.id, { page, signal })); }
        catch (error) { if (error instanceof ApiError && error.statusCode === 404) continue; throw error; }
        if (account !== memberId || signal.aborted) throw createAbortError();
        for (const list of lists) {
          if (list.ownerId !== person.memberId) continue;
          const id = crypto.randomUUID(); destinations.set(id, { groupId: group.id, wishlistId: list.id });
          result.push({ id, name: list.name, groupName: group.name });
        }
      }
      return result;
    },
    /** @param {string} memberId @param {Record<string,unknown>} value @param {AbortSignal} signal */
    async create(memberId, value, signal) {
      identity(memberId);
      const scope = destination(value.listId);
      const image = capturedImage(value.image);
      if (typeof value.name !== "string" || typeof value.price !== "string" || typeof value.url !== "string") throw new ApiError({ kind: "http", statusCode: 400 });
      const service = createGroupSuggestionsService(session, scope);
      const created = await service.create({ name: value.name, price: value.price, url: value.url, note: "", quantity: "1", addedViaExtension: true }, signal);
      if (image) {
        try { await service.uploadImage(created.id, image, created.entityTag, signal); }
        catch { return { success: true, imageSaved: false }; }
      }
      return { success: true, imageSaved: true };
    },
    /** @param {string} memberId @param {Record<string,unknown>} value @param {AbortSignal} signal */
    async image(memberId, value, signal) {
      identity(memberId);
      const scope = destination(value.listId);
      if (typeof value.url !== "string" || value.url.length > 2048) throw new ApiError({ kind: "http", statusCode: 400 });
      const response = await session.request(`/api/v1/groups/${scope.groupId}/wishlists/${scope.wishlistId}/suggestion-images/resolve`, {
        method: "POST", authentication: "required", csrf: true, body: { url: value.url }, signal,
      });
      const image = /** @type {{contentType?:unknown,contentBase64?:unknown}|null} */ (response.data);
      if (response.status !== 200 || image?.contentType !== "image/webp" || typeof image.contentBase64 !== "string" || image.contentBase64.length > 2799977 || !/^[A-Za-z0-9+/=]+$/.test(image.contentBase64)) throw new ApiError({ kind: "invalidResponse" });
      return { image: `data:image/webp;base64,${image.contentBase64}` };
    },
  };
}

/** @param {unknown} value Captured, normalized product image. */
function capturedImage(value) {
  if (value === "" || value === undefined) return null;
  if (typeof value !== "string" || value.length > 2800000 || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new ApiError({ kind: "http", statusCode: 400 });
  let bytes;
  try { bytes = Uint8Array.from(atob(value.split(",")[1]), char => char.charCodeAt(0)); }
  catch { throw new ApiError({ kind: "http", statusCode: 400 }); }
  if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(0,4)) !== "RIFF" || String.fromCharCode(...bytes.subarray(8,12)) !== "WEBP") throw new ApiError({ kind: "http", statusCode: 400 });
  return new Blob([bytes], { type: "image/webp" });
}
