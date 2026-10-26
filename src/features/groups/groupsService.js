import { ApiError, createAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isCalendarDate, isWishlistId, isWishlistOccasion } from "../wishlists/wishlistValidation.js";
import { isDisplayNameTag } from "../../auth/memberHandle.js";
import { validateWishImageFile } from "../wishes/wishImageValidation.js";

/** @typedef {{id:string, name:string, ownerId:string, profileImageUrl:string|null, memberCount:number, createdAt:string, updatedAt:string|null}} Group */
/** @typedef {{id:string, groupId:string, groupName:string, ownerDisplayName:string, memberId:string, displayName:string, displayNameTag:string, createdAt:string, expiresAt:string}} Invitation */
/** @typedef {{id:string, displayName:string, displayNameTag:string, profileImageUrl:string|null, joinedAt:string}} GroupMember */
/** @typedef {{id:string, name:string, ownerId:string, ownerDisplayName:string, occasion:import("../wishlists/wishlistValidation.js").WishlistOccasion, eventDate:string|null, createdAt:string}} GroupWishlist */
/** @template T @typedef {{items:T[],currentPage:number,pageSize:number,totalCount:number,totalPages:number,hasNextPage:boolean,hasPreviousPage:boolean}} Page */
/** @typedef {{signal:AbortSignal,page?:number}} ReadOptions */
/** @typedef {{groupId:string,code:string,joinUrl:string,createdAt:string}} GroupJoinLink */
/** @typedef {import("../../auth/sessionManager.js").SessionManager["request"]} Request */

/** Private groups use authenticated server grants, never public share tokens or stored bearer links.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager,"request">} session Transport.
 */
export function createGroupsService(session) {
  /** @param {string} path Endpoint. @param {import("../../api/apiClient.js").ApiRequestOptions} options Request options. */
  async function request(path, options) {
    if (options.signal?.aborted) throw createAbortError();
    const response = await session.request(path, { ...options, authentication: "required", csrf: options.method !== "GET" });
    if (options.signal?.aborted) throw createAbortError();
    return response;
  }
  /** @template T @param {string} path Endpoint. @param {ReadOptions} options Pagination. @param {(value:unknown)=>value is T} validate Contract guard. @param {number} [size] Page size. @returns {Promise<Page<T>>} */
  async function page(path, { signal, page: currentPage = 1 }, validate, size = 20) {
    if (!Number.isInteger(currentPage) || currentPage < 1 || currentPage > 2147483647) throw new TypeError("Invalid page.");
    const response = await request(`${path}?page=${currentPage}&pageSize=${size}`, { method: "GET", signal });
    const value = /** @type {Partial<Page<T>> | null} */ (response.data);
    const total = value?.totalCount;
    if (response.status !== 200 || !value || value.currentPage !== currentPage || value.pageSize !== size ||
      typeof total !== "number" || !Number.isSafeInteger(total) || total < 0 || !Array.isArray(value.items) ||
      value.items.length !== Math.min(size, Math.max(0, total - (currentPage - 1) * size)) || value.totalPages !== Math.ceil(total / size) ||
      value.hasNextPage !== (currentPage < Math.ceil(total / size)) || value.hasPreviousPage !== (total > 0 && currentPage > 1) ||
      !value.items.every(validate) || new Set(value.items.map(item => /** @type {{id:string}} */ (item).id)).size !== value.items.length) throw invalid();
    return /** @type {Page<T>} */ (value);
  }
  /** @param {import("../../api/apiClient.js").ApiResponse<unknown>} response Response. @param {number} status Expected success. */
  function versioned(response, status) {
    if (response.status !== status || !isGroup(response.data) || !isStrongEntityTag(response.metadata.etag)) throw invalid();
    return { group: response.data, etag: response.metadata.etag };
  }
  /** @param {string} path Endpoint. @param {AbortSignal} signal Lifetime. @param {string} [etag] Explicit optimistic version. */
  async function remove(path, signal, etag) {
    if (etag !== undefined && !isStrongEntityTag(etag)) throw new TypeError("Invalid version.");
    const response = await request(path, { method: "DELETE", signal, expectEmptyResponse: true, ...(etag ? { ifMatch: etag } : {}) });
    if (response.status !== 204 || response.data !== null) throw invalid();
  }
  return {
    /** @param {string} id @param {ReadOptions} options */
    joinLink: async (id, options) => readJoinLink(await request(`${groupPath(id)}/join-link`, { method: "GET", signal: options.signal }), id, 200),
    /** @param {string} id @param {ReadOptions} options */
    createJoinLink: async (id, options) => readJoinLink(await request(`${groupPath(id)}/join-link`, { method: "POST", signal: options.signal }), id, 201),
    /** @param {string} id @param {{etag:string,signal:AbortSignal}} options */
    revokeJoinLink: (id, options) => remove(`${groupPath(id)}/join-link`, options.signal, options.etag),
    /** @param {string} code @param {ReadOptions} options */
    join: async (code, options) => {
      const normalized = normalizeGroupCode(code);
      if (!normalized) throw new TypeError("Invalid group code.");
      const response = await request("/api/v1/groups/join", { method: "POST", shareToken: normalized, signal: options.signal });
      if (![200, 201].includes(response.status) || !isGroup(response.data)) throw invalid();
      return response.data;
    },
    /** @param {ReadOptions} options */
    load: options => page("/api/v1/groups", options, isGroup, 100),
    /** @param {string} id @param {ReadOptions} options */
    loadOne: async (id, options) => versioned(await request(groupPath(id), { method: "GET", signal: options.signal }), 200),
    /** @param {string} name @param {ReadOptions} options */
    create: async (name, options) => versioned(await request("/api/v1/groups", { method: "POST", body: { name: groupName(name) }, signal: options.signal }), 201),
    /** @param {string} id @param {string} name @param {{etag:string,signal:AbortSignal}} options */
    rename: async (id, name, options) => {
      if (!isStrongEntityTag(options.etag)) throw new TypeError("Invalid version.");
      return versioned(await request(groupPath(id), { method: "PUT", body: { name: groupName(name) }, ifMatch: options.etag, signal: options.signal }), 200);
    },
    /** @param {string} id @param {{etag:string,signal:AbortSignal}} options */
    remove: (id, options) => remove(groupPath(id), options.signal, options.etag),
    /** @param {string} id @param {Blob} file @param {{etag:string,signal:AbortSignal}} options */
    uploadImage: async (id, file, { etag, signal }) => {
      if (!isStrongEntityTag(etag)) throw new TypeError("Invalid version.");
      const path = `${groupPath(id)}/image`;
      if (signal.aborted) throw createAbortError();
      const type = await validateWishImageFile(file);
      if (signal.aborted) throw createAbortError();
      const formData = new FormData(); formData.append("image", new Blob([file], { type }), "group-profile-image");
      const result = versioned(await request(path, { method: "PUT", formData, ifMatch: etag, signal }), 200);
      if (result.group.id !== id || result.group.profileImageUrl === null) throw invalid();
      return result;
    },
    /** @param {string} id @param {{etag:string,signal:AbortSignal}} options */
    removeImage: async (id, { etag, signal }) => {
      if (!isStrongEntityTag(etag)) throw new TypeError("Invalid version.");
      const response = await request(`${groupPath(id)}/image`, { method: "DELETE", ifMatch: etag, expectEmptyResponse: true, signal });
      if (response.status !== 204 || response.data !== null || !isStrongEntityTag(response.metadata.etag)) throw invalid();
      return response.metadata.etag;
    },
    /** @param {string} id @param {ReadOptions} options */
    members: (id, options) => page(`${groupPath(id)}/members`, options, isMember, 100),
    /** @param {string} id @param {string} memberId @param {ReadOptions} options */
    removeMember: (id, memberId, options) => remove(`${groupPath(id)}/members/${identifier(memberId)}`, options.signal),
    /** @param {string} id @param {ReadOptions} options */
    leave: (id, options) => remove(`${groupPath(id)}/members/current`, options.signal),
    /** @param {ReadOptions} options */
    invitations: options => page("/api/v1/group-invitations", options, isInvitation),
    /** @param {string} id @param {ReadOptions} options */
    sentInvitations: (id, options) => page(`${groupPath(id)}/invitations`, options, isInvitation, 100),
    /** @param {string} id @param {string} memberId @param {ReadOptions} options */
    invite: async (id, memberId, options) => {
      const response = await request(`${groupPath(id)}/invitations`, { method: "POST", body: { memberId: identifier(memberId) }, signal: options.signal });
      if (response.status !== 201 || !isInvitation(response.data) || response.data.groupId !== id || response.data.memberId !== memberId) throw invalid();
      return response.data;
    },
    /** @param {string} id @param {ReadOptions} options */
    accept: async (id, options) => {
      const response = await request(`/api/v1/group-invitations/${identifier(id)}/accept`, { method: "POST", signal: options.signal });
      if (response.status !== 200 || !isGroup(response.data)) throw invalid();
      return response.data;
    },
    /** @param {string} id @param {ReadOptions} options */
    decline: (id, options) => remove(`/api/v1/group-invitations/${identifier(id)}`, options.signal),
    /** @param {string} groupId @param {string} id @param {ReadOptions} options */
    revoke: (groupId, id, options) => remove(`${groupPath(groupId)}/invitations/${identifier(id)}`, options.signal),
    /** @param {string} id @param {ReadOptions} options */
    wishlists: (id, options) => page(`${groupPath(id)}/wishlists`, options, isGroupWishlist),
    /** @param {string} id @param {string} wishlistId @param {ReadOptions} options */
    share: async (id, wishlistId, options) => {
      const response = await request(`${groupPath(id)}/wishlists/${identifier(wishlistId)}`, { method: "PUT", signal: options.signal });
      if (response.status !== 201 || !isGroupWishlist(response.data) || response.data.id !== wishlistId) throw invalid();
      return response.data;
    },
    /** @param {string} id @param {string} wishlistId @param {ReadOptions} options */
    unshare: (id, wishlistId, options) => remove(`${groupPath(id)}/wishlists/${identifier(wishlistId)}`, options.signal),
  };
}

/** @param {string} value Untrusted manually entered code. @returns {string|null} Canonical 80-bit code. */
export function normalizeGroupCode(value) {
  if (value.length > 32) return null;
  const normalized = value.trim().replaceAll("-", "").toUpperCase();
  return /^[A-Z2-7]{16}$/.test(normalized) ? normalized : null;
}

/** @param {import("../../api/apiClient.js").ApiResponse<unknown>} response @param {string} id @param {number} status */
function readJoinLink(response, id, status) {
  const link = /** @type {GroupJoinLink|null} */ (response.data);
  if (response.status !== status || !link || link.groupId !== id || typeof link.code !== "string" || normalizeGroupCode(link.code) !== link.code || !utc(link.createdAt) || !isStrongEntityTag(response.metadata.etag)) throw invalid();
  try {
    const url = new URL(link.joinUrl, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== "/groups/join" || url.search || url.hash !== `#${link.code}` || url.username || url.password) throw invalid();
  } catch { throw invalid(); }
  return { link, etag: response.metadata.etag };
}

/** @param {unknown} value @returns {value is Group} */
function isGroup(value) { const v = /** @type {Group|null} */ (value); return !!v && isWishlistId(v.id) && name(v.name) && isWishlistId(v.ownerId) && (v.profileImageUrl === null || typeof v.profileImageUrl === "string") && Number.isInteger(v.memberCount) && v.memberCount >= 1 && v.memberCount <= 100 && utc(v.createdAt) && (v.updatedAt === null || utc(v.updatedAt)); }
/** @param {unknown} value @returns {value is GroupMember} */
function isMember(value) { const v = /** @type {GroupMember|null} */ (value); return !!v && isWishlistId(v.id) && name(v.displayName) && isDisplayNameTag(v.displayNameTag) && (v.profileImageUrl === null || typeof v.profileImageUrl === "string") && utc(v.joinedAt); }
/** @param {unknown} value @returns {value is Invitation} */
function isInvitation(value) { const v = /** @type {Invitation|null} */ (value); return !!v && isWishlistId(v.id) && isWishlistId(v.groupId) && isWishlistId(v.memberId) && name(v.groupName) && name(v.ownerDisplayName) && name(v.displayName) && isDisplayNameTag(v.displayNameTag) && utc(v.createdAt) && utc(v.expiresAt); }
/** @param {unknown} value @returns {value is GroupWishlist} */
function isGroupWishlist(value) { const v = /** @type {GroupWishlist|null} */ (value); return !!v && isWishlistId(v.id) && isWishlistId(v.ownerId) && name(v.name) && name(v.ownerDisplayName) && isWishlistOccasion(v.occasion) && (v.eventDate === null || isCalendarDate(v.eventDate)) && utc(v.createdAt); }
/** @param {unknown} value @returns {value is string} */
function name(value) { return typeof value === "string" && !!value.trim() && !/[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(value); }
/** @param {unknown} value @returns {value is string} */
function utc(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) && Number.isFinite(Date.parse(value)); }
/** @param {string} value */
function identifier(value) { if (!isWishlistId(value)) throw new TypeError("Invalid identifier."); return value; }
/** @param {string} value */
function groupPath(value) { return `/api/v1/groups/${identifier(value)}`; }
/** @param {string} value */
function groupName(value) { if (!name(value) || [...value.trim()].length > 100) throw new TypeError("Invalid group name."); return value.trim(); }
function invalid() { return new ApiError({ kind: "invalidResponse" }); }
