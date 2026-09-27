/** Decorative occasion artwork extracted from the approved initial mockup.
 * @param {string} occasion Actual list occasion.
 * @returns {string} Public local artwork path.
 */
export function wishlistArtwork(occasion) {
  const name = ["birthday", "christmas", "wedding"].includes(occasion) ? occasion : "other";
  return `/images/design/${name}.webp`;
}
