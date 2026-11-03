/** Aligns an absolutely positioned header panel with its trigger while retaining the header gutters.
 * @param {HTMLElement} panel Open compact-header panel.
 * @param {HTMLElement} trigger Its visible trigger.
 */
export function alignHeaderPanel(panel, trigger) {
  const parent = panel.offsetParent;
  if (!(parent instanceof HTMLElement)) return;
  const bounds = parent.getBoundingClientRect(), padding = getComputedStyle(parent);
  const width = panel.getBoundingClientRect().width;
  const first = bounds.left + (Number.parseFloat(padding.paddingLeft) || 0);
  const last = bounds.right - (Number.parseFloat(padding.paddingRight) || 0) - width;
  const left = Math.max(first, Math.min(trigger.getBoundingClientRect().right - width, last));
  panel.style.setProperty("--header-panel-inline-start", `${left - bounds.left}px`);
}
