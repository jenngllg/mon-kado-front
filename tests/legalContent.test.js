// @vitest-environment happy-dom
/* global DOMParser */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/** @param {string} filename */
function readDocument(filename) {
  const main = readFileSync(pathToFileURL(resolve(process.cwd(), filename)), "utf8").match(/<main\b[\s\S]*?<\/main>/)?.[0];
  expect(main).toBeTruthy();
  // Parse only the public prose; styles and navigation scripts belong to browser tests.
  return new DOMParser().parseFromString(main ?? "", "text/html");
}

/** @param {Document} document @param {string} id */
function section(document, id) {
  const heading = document.getElementById(id);
  expect(heading?.tagName).toBe("H2");
  let text = "";
  for (let node = heading?.nextElementSibling; node && node.tagName !== "H2"; node = node.nextElementSibling) text += ` ${node.textContent}`;
  return text;
}

describe("public legal information", () => {
  it("describes optional extension access, image preparation before confirmation and retained additions", () => {
    const document = readDocument("privacy-policy.html");
    const extension = section(document, "extension");
    for (const fact of ["facultative", "onglet actif", "prix", "adresses des images", "avant la confirmation", "après ta confirmation", "ne consulte pas ton historique général", "ne conserve ni ton mot de passe ni tes jetons", "supprimé avec le compte", "Désinstaller l’extension ne supprime pas"]) expect(extension).toContain(fact);
  });

  it("explains push permission, separate preferences, delivery services and a generic message", () => {
    const notifications = section(readDocument("privacy-policy.html"), "notifications");
    for (const fact of ["séparément", "autorisation du navigateur", "retirer cette autorisation", "onglets MonKado sont fermés", "abonnement chiffrée", "Apple", "Google", "Mozilla", "sans nom de personne", "message générique", "supprimés avec le compte"]) expect(notifications).toContain(fact);
  });

  it("distinguishes public sharing, group access and reservation visibility under surprise mode", () => {
    const sharing = section(readDocument("privacy-policy.html"), "sharing");
    for (const fact of ["visible par défaut", "sauf ceux qu’il exclut", "partage de groupe distinct", "lien public indépendant", "cachées à leur bénéficiaire", "réservations des autres participants", "Hors mode surprise", "nom affiché", "ne rend pas ces informations publiques"]) expect(sharing).toContain(fact);
  });

  it("keeps the concise account-linked trace notice and restricted administrative access", () => {
    const document = readDocument("privacy-policy.html");
    const notice = [...document.querySelectorAll("main p")].find(node => node.textContent?.startsWith("Des traces d’utilisation"))?.textContent ?? "";
    for (const fact of ["associées au compte", "diagnostic", "textes des listes et des souhaits", "excluant les mots de passe", "administrateurs habilités", "consulter et modifier", "interventions sont enregistrées"]) expect(notice).toContain(fact);
    expect(notice.split(/\s+/).length).toBeLessThan(100);
    expect(document.querySelector("main")?.textContent).toContain("90 jours");
    expect(document.querySelector("main")?.textContent).not.toMatch(/simulation|payloads|JSON métier|par conteneur/);
  });

  it("keeps unresolved decisions explicit without implying accepted terms or guaranteed delivery", () => {
    const privacy = readDocument("privacy-policy.html");
    const terms = readDocument("terms-of-use.html");
    expect(privacy.querySelector("[data-publication-draft]")?.textContent).toContain("bases légales");
    expect(terms.querySelector("[data-publication-draft]")?.textContent).toContain("non approuvée");
    expect(section(terms, "notifications")).toContain("n’est pas garantie");
    expect(section(terms, "extension")).toContain("ni achat ni paiement");
    const link = terms.querySelector('a[href="/privacy-policy#extension"]');
    expect(link?.textContent).toBe("politique de confidentialité");
    expect(privacy.getElementById(link?.getAttribute("href")?.split("#")[1] ?? "")).not.toBeNull();
  });
});
