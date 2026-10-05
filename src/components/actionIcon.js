const Paths = {
  view: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12m13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0",
  edit: "M16 3l5 5L9 20l-6 1 1-6L16 3ZM14 5l5 5M4 15l5 5",
  delete: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
};

/** Adds a decorative icon to an action while retaining its accessible name.
 * @param {HTMLElement} control Named link or button.
 * @param {keyof typeof Paths} icon Action icon.
 * @param {string} title Hover label.
 */
export function applyActionIcon(control, icon, title) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", Paths[icon]);
  svg.append(path);
  control.replaceChildren(svg);
  control.classList.add("icon-action");
  control.title = title;
}
