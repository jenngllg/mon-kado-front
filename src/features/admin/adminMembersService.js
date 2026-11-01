import { ApiError } from "../../api/apiError.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** @typedef {Readonly<{id:string,displayName:string,displayNameTag:string}>} AdminMember */
/** @param {Pick<import("../../auth/sessionManager.js").SessionManager,"request">} session Authenticated transport. */
export function createAdminMembersService(session) {
  /** @param {unknown} data Server identity. @returns {AdminMember} */
  function member(data) {
    const value = /** @type {AdminMember|null} */ (data);
    if (!value || !isWishlistId(value.id) || typeof value.displayName !== "string" || !value.displayName.trim() || !/^\d{4}$/.test(value.displayNameTag)) throw new ApiError({kind:"invalidResponse"});
    return Object.freeze({id:value.id,displayName:value.displayName,displayNameTag:value.displayNameTag});
  }
  /** @param {string} id Target account. */
  function path(id) { if (!isWishlistId(id)) throw new TypeError("Invalid member identifier"); return `/api/v1/admin/members/${id}`; }
  return {
    /** @param {{page:number,q:string,signal:AbortSignal}} options Read filters. */
    async load({page,q,signal}) {
      const result = await session.request(`/api/v1/admin/members?${new URLSearchParams({page:String(page),pageSize:"20",q})}`, {method:"GET",authentication:"required",signal});
      const data = /** @type {{items:unknown[],currentPage:number,pageSize:number,totalCount:number,totalPages:number,hasPreviousPage:boolean,hasNextPage:boolean}|null} */ (result.data);
      if (result.status!==200 || !data || !Array.isArray(data.items) || data.currentPage!==page || data.pageSize!==20 || !Number.isSafeInteger(data.totalCount) || data.totalCount<0 || data.totalPages!==Math.ceil(data.totalCount/20) || typeof data.hasPreviousPage!=="boolean" || typeof data.hasNextPage!=="boolean") throw new ApiError({kind:"invalidResponse"});
      return {...data,items:data.items.map(member)};
    },
    /** @param {string} id Target. @param {AbortSignal} signal Lifetime. */
    async loadOne(id,signal) {
      const result=await session.request(path(id),{method:"GET",authentication:"required",signal});
      if(result.status!==200) throw new ApiError({kind:"invalidResponse"});
      const value=member(result.data); if(value.id!==id) throw new ApiError({kind:"invalidResponse"}); return value;
    },
    /** @param {string} id Confirmed target. @param {string} reference Support reference. @param {AbortSignal} signal Lifetime. */
    async erase(id,reference,signal) {
      const result=await session.request(`${path(id)}/erasure-requests`,{method:"POST",authentication:"required",csrf:true,expectEmptyResponse:true,body:{confirmedMemberId:id,requestReference:reference},signal});
      if(result.status!==204)throw new ApiError({kind:"invalidResponse"});
    },
  };
}
