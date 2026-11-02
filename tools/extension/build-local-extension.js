import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const source = new URL("extension/", root);
const destination = new URL(".local/extension-local-session-test/", root);
const origin = "https://localhost:5189";
const files = ["popup.html", "popup.css", "popup.js", "suggestionFlow.js", "extract.js", "imageSelection.js", "session-bridge.js", "icon.png"];

// Keep the installed local extension on the same code as the public variant.
await cp(destination, new URL(`.local/extension-local-before-${Date.now()}/`, root), { recursive: true });
await mkdir(destination, { recursive: true });
for (const file of files) {
  if (file === "popup.js") {
    const content = await readFile(new URL(file, source), "utf8");
    await writeFile(new URL(file, destination), content.replaceAll("https://www.monkado.fr", origin));
  } else {
    await cp(new URL(file, source), new URL(file, destination));
  }
}
const manifest = JSON.parse(await readFile(new URL("manifest.json", source), "utf8"));
manifest.name = "MonKado — essai local";
manifest.host_permissions = [`${origin}/*`];
manifest.content_scripts = [{ matches: [`${origin}/*`], js: ["session-bridge.js"] }];
manifest.action.default_title = "Ajouter à MonKado — local";
await writeFile(new URL("manifest.json", destination), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(new URL("README.md", destination), `# Extension MonKado locale\n\nVersion ${manifest.version}, générée depuis extension/ avec node tools/extension/build-local-extension.js.\n\nCette variante utilise uniquement ${origin}, avec sa session existante. Elle ne peut pas ajouter de souhait sur le site public. Recharger « MonKado — essai local » dans Chrome, puis actualiser le site local. Le sélecteur « Listes * » permet de cocher plusieurs listes et reste sans encart.\n`);
