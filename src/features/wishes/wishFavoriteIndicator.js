import { applyActionIcon } from "../../components/actionIcon.js";

/** @returns {HTMLSpanElement} Noninteractive owner preference, never a visitor command. */
export function createWishFavoriteIndicator() {
  const indicator = document.createElement("span");
  indicator.className = "wish-favorite-indicator";
  indicator.setAttribute("role", "img"); indicator.setAttribute("aria-label", "Coup de cœur");
  applyActionIcon(indicator, "heart", "Coup de cœur");
  return indicator;
}
