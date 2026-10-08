import user from "../assets/icons/user.svg?raw";
import shield from "../assets/icons/shield-check.svg?raw";
import email from "../assets/icons/envelope.svg?raw";
import password from "../assets/icons/key.svg?raw";
import authenticator from "../assets/icons/finger-print.svg?raw";
import information from "../assets/icons/information-circle.svg?raw";

const Icons = { user, shield, email, password, authenticator, information };

/** Returns a decorative, locally bundled Heroicons outline.
 * @param {keyof typeof Icons} name Account icon.
 * @returns {HTMLElement} Noninteractive decoration.
 */
export function createAccountIcon(name) {
  const wrapper = document.createElement("span");
  wrapper.className = "account-icon";
  wrapper.setAttribute("aria-hidden", "true");
  const svg = new DOMParser().parseFromString(Icons[name].replace(/>\s+</g, "><"), "image/svg+xml").documentElement;
  svg.setAttribute("focusable", "false");
  wrapper.append(svg);
  return wrapper;
}

