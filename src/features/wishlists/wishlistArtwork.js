import birthday from "../../assets/design/birthday.webp";
import christmas from "../../assets/design/christmas.webp";
import wedding from "../../assets/design/wedding.webp";
import birth from "../../assets/design/birth.webp";
import other from "../../assets/design/other.webp";
import birthdayIcon from "../../assets/design/birthday-icon.webp";
import christmasIcon from "../../assets/design/christmas-icon.webp";
import weddingIcon from "../../assets/design/wedding-icon.webp";
import otherIcon from "../../assets/design/other-icon.webp";

/** Decorative local occasion cover selected by the user.
 * @param {string} occasion Actual list occasion.
 * @returns {string} Public local artwork path.
 */
export function wishlistArtwork(occasion) {
  if (occasion === "birthday") return birthday;
  if (occasion === "christmas") return christmas;
  if (occasion === "wedding") return wedding;
  if (occasion === "birth") return birth;
  return other;
}

/** Decorative occasion icon with its own build-resolved asset URL.
 * @param {string} occasion Actual list occasion.
 * @returns {string} Public local icon path.
 */
export function wishlistOccasionIcon(occasion) {
  if (occasion === "birthday") return birthdayIcon;
  if (occasion === "christmas") return christmasIcon;
  if (occasion === "wedding") return weddingIcon;
  return otherIcon;
}
