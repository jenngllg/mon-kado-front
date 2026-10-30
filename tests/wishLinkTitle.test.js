import { describe, expect, it } from "vitest";
import { suggestNameFromProductUrl } from "../src/features/wishes/wishLinkTitle.js";

describe("tentative product name from a URL", () => {
  it.each([
    ["https://www.fnac.com/Figurine-Funko-Pop-TV-Wednesday-Addams/a21262654/w-4", "Figurine Funko Pop TV Wednesday Addams"],
    ["https://www.fr.fnac.be/POP-TV-Wednesday-Rave-n-W/a19427058?oref=private#section", "POP TV Wednesday Rave n W"],
    ["https://www.cultura.com/p-buffy-contre-les-vampires-figurine-pop-buffy-w-scythe-9-cm-12661219.html", "buffy contre les vampires figurine pop buffy w scythe 9 cm"],
    ["https://www.sezane.com/fr-fr/product/gilet-gaspard/beige-clair", "gilet gaspard beige clair"],
    ["https://www.recyclivre.com/boutique/produit/livre/9782073143815-le-petit-prince/019dab3b-d8f5-7aee-a607-1d43942dac65", "le petit prince"],
    ["https://www.cdiscount.com/juniors/jeux-de-construction/lego-r-icons-10311-l-orchidee-plantes-de-fleurs/f-12083-lego10311.html", "lego r icons 10311 l orchidee plantes de fleurs"],
    ["https://www.smythstoys.com/fr/fr-fr/jouets/lego/lego-botanicals/lego-icons-10311-lorchidee/p/204044", "lego icons 10311 lorchidee"],
    ["https://www.castorama.fr/mkp/lampe-poser-en-m-tal-mila-32cm-blanc/5400924331436_CAFR.prd", "lampe poser en m tal mila 32cm blanc"],
    ["https://www.bhv.fr/p/vase%2Bmarocain%2B-%2Borange%2Brose%2B-%2Bs-hay/300408518849/356", "vase marocain orange rose s hay"],
    ["https://www.sarenza.com/fr/fr/baskets-basses-stan-smith-blanc/PCID_548312.html", "baskets basses stan smith blanc"],
    ["https://www.adidas.fr/chaussure-stan-smith/M20324.html", "chaussure stan smith"],
    ["https://shop.mango.com/fr/fr/p/femme/pulls-et-cardigans/col-montant/pull-col-montant-fronce/17009123/05/00", "pull col montant fronce"],
    ["https://www.marionnaud.fr/parfum/parfum-femme/eau-de-parfum/la-vie-est-belle-eau-de-parfum-rechargeable-lancome/p/BP_100257559", "la vie est belle eau de parfum rechargeable lancome"],
    ["https://www.yves-rocher.fr/parfum/parfum-femme/eau-de-parfum-femme/eau-de-parfum-vanille/p/mp-00007613", "eau de parfum vanille"],
    ["https://www.decathlon.fr/p/gourde-900-isotherme-inox-0-8l-bouchon-a-ouverture-rapide-pour-la-randonnee/_/R-p-301275", "gourde 900 isotherme inox 0 8l bouchon a ouverture rapide pour la randonnee"],
    ["https://www.intersport.fr/gourde_inox_1_l-sveltus-p-92030~~1FG/", "gourde inox 1 l sveltus"],
    ["https://www.lego.com/fr-fr/product/orchid-10311", "orchid 10311"],
    ["https://shop.example/products/photo-album-portrait", "photo album portrait"],
    ["https://shop.example/products/bo%C3%AEte-%C3%A0-th%C3%A9.html", "boîte à thé"],
    ["https://example.test/catalog/lampe-de-bureau/p/204044", "lampe de bureau"],
    ["https://other.test/product/gilet-gaspard/beige-clair", "gilet gaspard beige clair"],
    ["https://other.test/products/boite-a-musique/a21262654/w-4", "boite a musique"],
    ["https://other.test/categories/jeux-de-construction/ref-883775-10311-lego-botanique-l-orchidee.htm", "ref 883775 10311 lego botanique l orchidee"],
    ["https://shop.example/products/wireless-headphones/QC2G-HEADPHONEARN.html", "wireless headphones"],
  ])("uses only a readable product path: %s", (url, expected) => {
    expect(suggestNameFromProductUrl(url)).toBe(expected);
  });
  it.each([
    "https://www.laredoute.fr/ppdp/prod-602388338.aspx?keyword=private",
    "https://shop.example/products/123456789",
    "https://shop.example/019dab3b-d8f5-7aee-a607-1d43942dac65",
    "https://shop.example/household-products/items/123456789",
    "https://shop.example/generic-products/p/204044",
    "https://shop.example/generic-products/M20324.html",
    "https://shop.example/collections/table-lamps/1234567",
    "https://shop.example/categorie/cadeaux-pour-elle/1234567",
    "https://shop.example/password-reset",
    "https://shop.example/products/token-secret-abc123",
    "https://www.cultura.com/p-10311-tbd-icon-lifestyle-v29-5702017224336.html",
    "https://shop.example/products/gift-%2Fsecret",
    "https://shop.example/products/gift-%5Csecret",
    "https://shop.example/products/%E0%A4%A",
    "https://shop.example/products/long-" + "a".repeat(41),
    "https://user:secret@shop.example/pretty-gift",
    "javascript:alert(1)",
  ])("does not invent a name for opaque, private or unsafe paths: %s", (url) => {
    expect(suggestNameFromProductUrl(url)).toBe("");
  });
});
