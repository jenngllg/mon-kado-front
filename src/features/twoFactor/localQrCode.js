import QRCode from "qrcode";

/** Render locally without a third-party image URL, canvas export or HTML injection.
 * @param {string} uri Validated otpauth URI, never persisted.
 * @returns {SVGSVGElement} In-memory QR image.
 */
export function createLocalQrCode(uri) {
  const { modules } = QRCode.create(uri, { errorCorrectionLevel: "M" });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const size = modules.size + 8;
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", "240"); svg.setAttribute("height", "240");
  svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Code QR pour ton application d’authentification");
  const background = document.createElementNS(svg.namespaceURI, "rect");
  background.setAttribute("width", String(size)); background.setAttribute("height", String(size)); background.setAttribute("fill", "white");
  const path = document.createElementNS(svg.namespaceURI, "path");
  const commands = [];
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) commands.push(`M${column + 4} ${row + 4}h1v1h-1z`);
    }
  }
  path.setAttribute("d", commands.join("")); path.setAttribute("fill", "black");
  svg.append(background, path);
  return svg;
}
