import birthday from "../../assets/design/birthday.webp";
import christmas from "../../assets/design/christmas.webp";
import wedding from "../../assets/design/wedding.webp";
import birth from "../../assets/design/birth.webp";
import other from "../../assets/design/other.webp";
import birthday200 from "../../assets/design/birthday-200.webp";
import birthday400 from "../../assets/design/birthday-400.webp";
import christmas200 from "../../assets/design/christmas-200.webp";
import christmas400 from "../../assets/design/christmas-400.webp";
import wedding200 from "../../assets/design/wedding-200.webp";
import wedding400 from "../../assets/design/wedding-400.webp";
import birth200 from "../../assets/design/birth-200.webp";
import birth400 from "../../assets/design/birth-400.webp";
import other200 from "../../assets/design/other-200.webp";
import other400 from "../../assets/design/other-400.webp";
import birthdayIcon from "../../assets/design/birthday-icon.webp";
import christmasIcon from "../../assets/design/christmas-icon.webp";
import weddingIcon from "../../assets/design/wedding-icon.webp";
import birthIcon from "../../assets/design/birth-icon.svg";
import otherIcon from "../../assets/design/other-icon.webp";

/** @type {Readonly<Record<string, readonly [string, string]>>} */
const ResponsiveArtwork = Object.freeze({ birthday: [birthday200, birthday400], christmas: [christmas200, christmas400],
  wedding: [wedding200, wedding400], birth: [birth200, birth400], other: [other200, other400] });

/** Cover widths mirror the compact mobile row and the two/four-column overview grids. */
export const WishlistCardArtworkSizes = "(max-width: 35.999rem) 5.5rem, (max-width: 63.999rem) 50vw, min(25vw, 320px)";

/** Native browser selection keeps the original available for large displays and high pixel densities.
 * @param {string} occasion Actual list occasion.
 * @returns {string} Width-described image candidates.
 */
export function wishlistArtworkSources(occasion) {
  const [small, medium] = ResponsiveArtwork[occasion] ?? ResponsiveArtwork.other;
  return `${small} 200w, ${medium} 400w, ${wishlistArtwork(occasion)} 800w`;
}

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
  if (occasion === "birth") return birthIcon;
  return otherIcon;
}
