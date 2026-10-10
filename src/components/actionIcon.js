import gripSource from "../assets/icons/grip-vertical.svg?raw";

const Paths = {
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  add: "M12 5v14M5 12h14",
  copy: "M9 9h12v12H9zM5 15H3V3h12v2",
  archive: "M3 3h18v4H3zM5 7v14h14V7M9 11h6",
  view: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12m13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0",
  edit: "M16 3l5 5L9 20l-6 1 1-6L16 3ZM14 5l5 5M4 15l5 5",
  delete: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
};

/** Adds a decorative icon to an action while retaining its accessible name.
 * @param {HTMLElement} control Named link or button.
 * @param {keyof typeof Paths | "reorder"} icon Action icon.
 * @param {string} title Hover label.
 */
export function applyActionIcon(control, icon, title) {
  if (!control.hasAttribute("aria-label")) control.setAttribute("aria-label", control.textContent?.trim() || title);
  const svg = icon === "reorder"
    ? new DOMParser().parseFromString(gripSource, "image/svg+xml").documentElement
    : document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (icon !== "reorder") {
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", Paths[icon]);
    svg.append(path);
  }
  control.replaceChildren(svg);
  control.classList.add("icon-action");
  control.title = title;
}
