import { createMemberAvatar } from "../../components/memberAvatar.js";
import { readGroupPhoto } from "./groupPhoto.js";

/** The identity shown to both the sender and recipient; never includes private lists or member names.
 * @param {{id:string,name:string,memberCount:number,profileImageUrl:string|null}} group Advertised identity.
 * @param {string} apiBaseUrl Trusted photo origin.
 * @param {"h2"|"h3"} [heading] Contextual heading level.
 */
export function createGroupInvitationPreview(group, apiBaseUrl, heading = "h3") {
  const card = document.createElement("article"); card.className = "group-invitation-preview";
  card.setAttribute("aria-label", "Aperçu du groupe");
  const photo = readGroupPhoto(group.profileImageUrl, group.id, apiBaseUrl);
  const avatar = createMemberAvatar({ memberId: group.id, imageUrl: photo.imageUrl, size: 56 });
  const copy = document.createElement("div"), title = document.createElement(heading), count = document.createElement("p");
  title.textContent = group.name; count.textContent = `${group.memberCount} membre${group.memberCount > 1 ? "s" : ""}`;
  copy.append(title, count); card.append(avatar, copy);
  return card;
}
