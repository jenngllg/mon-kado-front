import { createButton } from "../../components/index.js";
import logoUrl from "../../assets/google/g-logo.png";

/** A local, SDK-free Google action, independent of native form submission.
 * @param {() => void} onClick Explicit departure.
 * @returns {HTMLButtonElement} Branded, keyboard-accessible button.
 */
export function createGoogleButton(onClick) {
  const logo = document.createElement("img");
  logo.src = logoUrl;
  logo.alt = "";
  logo.width = 20;
  logo.height = 20;
  const button = createButton({ label: "Continuer avec Google", variant: "secondary", onClick, decorativeElement: logo });
  button.classList.add("google-button");
  return button;
}
