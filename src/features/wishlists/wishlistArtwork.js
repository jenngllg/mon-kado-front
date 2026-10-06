import birthday from "../../assets/design/birthday.webp";
import christmas from "../../assets/design/christmas.webp";
import wedding from "../../assets/design/wedding.webp";
import other from "../../assets/design/other.webp";

/** Decorative occasion artwork extracted from the approved initial mockup.
 * @param {string} occasion Actual list occasion.
 * @returns {string} Public local artwork path.
 */
export function wishlistArtwork(occasion) {
  if (occasion === "birthday") return birthday;
  if (occasion === "christmas") return christmas;
  if (occasion === "wedding") return wedding;
  return other;
}
