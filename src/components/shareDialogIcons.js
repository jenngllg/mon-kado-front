import closeSource from "../assets/icons/x-mark.svg?raw";
import shareSource from "../assets/icons/share.svg?raw";

/** Mounts an unchanged, locally bundled Heroicons asset without user-derived markup.
 * @param {HTMLElement} control Existing named control.
 * @param {"close" | "share"} icon Official asset.
 */
export function prependShareDialogIcon(control, icon) {
  const source = icon === "close" ? closeSource : shareSource;
  const svg = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
  svg.replaceChildren(...svg.children);
  control.prepend(document.importNode(svg, true));
}
