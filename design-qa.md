# Design QA — Fondations graphiques MonKado

## Références et état comparé

- Source visuelle : `../mon-kado/prototypes/wishlist-site/design/mockups/03-shared-wishlist-selected-concept.png`
- Capture de l’implémentation : `mk854-desktop.png`, capture temporaire du navigateur non versionnée
- Source : 1487 × 1058 px
- Implémentation : viewport et capture 1440 × 900 px, densité 1
- État : écran de démarrage avec une configuration API valide
- Comparaison combinée : `mk854-comparison.png`, artefact temporaire non versionné

Les deux captures ne représentent volontairement pas le même écran fonctionnel :
cette US transpose uniquement les fondations graphiques de la maquette sur
l’écran de démarrage existant.

## Comparaison générale

La typographie Nunito Sans, le fond ivoire, la surface claire, le texte vert
forêt, l’accent corail, le rayon et l’ombre légère reprennent le langage visuel
de la maquette. La hiérarchie reste lisible sans introduire de navigation, de
composant métier ou d’asset du prototype.

## Surfaces de fidélité

- Typographie : Nunito Sans Variable est chargée localement ; les graisses,
  interlignages et tailles fluides produisent une hiérarchie proche de la
  référence, sans synthèse de police.
- Espacement et mise en page : la carte conserve un rythme généreux et reste
  centrée. Les contrôles à 320, 360, 768 et 1440 px ne montrent aucun
  débordement horizontal.
- Couleurs et tokens : l’ivoire, le sauge, le vert forêt et le corail sont
  cohérents avec la maquette et centralisés dans les tokens sémantiques.
- Images : aucune image n’est attendue dans l’écran socle et aucun asset de la
  maquette n’a été copié ou remplacé par un dessin CSS.
- Contenu : les textes techniques existants sont conservés et restent lisibles
  dans les états normal et erreur.

Une comparaison focalisée supplémentaire n’est pas nécessaire : la surface
livrée ne contient qu’un bloc typographique et ses détails restent lisibles dans
la comparaison générale.

## Responsive, accessibilité et comportement

- Viewports vérifiés : 320 × 800, 360 × 800, 768 × 1024 et 1440 × 900.
- L’état d’erreur de configuration a été vérifié à 360 × 800.
- Les styles reposent sur des unités relatives, des dimensions fluides et une
  largeur minimale de 320 px ; le stress test à la largeur minimale conserve
  tout le contenu visible.
- Le zoom navigateur n’est pas pilotable par l’outil de capture ; sa résilience
  est couverte par les unités `rem`, le retour à la ligne et le test à 320 px.
- La réduction des mouvements et le focus visible sont définis dans le socle.
- L’écran ne contient encore aucun contrôle interactif à tester au clavier.
- Aucun avertissement ni erreur n’a été relevé dans la console.

## Findings

Aucun écart P0, P1 ou P2 n’a été identifié dans le périmètre de cette US.

## Comparison history

La première comparaison n’a révélé aucun écart nécessitant une itération P0,
P1 ou P2. La ligne décorative initiale a été remplacée avant la capture finale
par une bordure sémantique, afin de conserver l’accent visuel sans fabriquer un
asset en CSS.

## Follow-up polish

- [P3] Réévaluer la largeur maximale de l’écran socle lorsque le véritable shell
  applicatif sera développé.

final result: passed
