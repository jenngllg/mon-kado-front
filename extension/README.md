# Extension Chrome MonKado

L’extension utilise les comptes et listes du site public `https://www.monkado.fr`. Elle lit les informations disponibles directement dans la page produit au clic sur son icône. Aucun appel d’analyse de lien n’est effectué. Le nom et le prix restent modifiables. La quantité souhaitée, initialement à 1, est réglable de 1 à 100 avec les boutons −/+ ou au clavier, pour les souhaits personnels comme pour les idées surprises. Chaque liste choisie reçoit cette quantité ; les deux modes conservent leur propre brouillon. Elle propose jusqu’à douze photos détectées ; la première est sélectionnée automatiquement et reste remplaçable, avec une option « Sans image ». Le cœur « Coup de cœur » se colore au clic et est enregistré avec chaque souhait personnel.

Avec une seule liste personnelle, le choix utilise une liste déroulante simple. Avec plusieurs listes, la liste déroulante permet de cocher plusieurs destinations. La première liste est cochée initialement. Un clic sur « Ajouter » crée un souhait indépendant dans chaque liste choisie. Les succès sont conservés lors d’un refus partiel : une nouvelle confirmation ne vise que les listes restantes. Un résultat incertain bloque toute nouvelle tentative dans cette fenêtre et demande une vérification dans MonKado.

Dans « Idée surprise », choisir d’abord une personne présente dans ses groupes, puis cocher une ou plusieurs de ses listes partagées. Chaque destination indique son groupe. La même liste dans deux groupes reste deux destinations privées distinctes. « Proposer l’idée » enregistre directement les suggestions, cachées au bénéficiaire, sans ouvrir d’éditeur au préalable. La première photo est présélectionnée. Les brouillons personnel et surprise sont indépendants ; cœur, couleur et taille restent propres aux souhaits personnels. Un échec de photo signale les destinations concernées sans recréer les suggestions confirmées.

Le relais du site annonce la prise en charge des coups de cœur. Si le site est plus ancien, l’extension demande de le mettre à jour puis d’actualiser son onglet avant d’envoyer un coup de cœur, pour éviter de perdre ce choix.

Les miniatures proviennent des adresses d’images indiquées par la page. Lorsqu’une photo est choisie, l’extension la lit depuis l’onglet produit, sans cookies ni nouvelle demande d’autorisation, puis la redimensionne avant l’envoi à MonKado. Les restrictions entre domaines peuvent empêcher l’import de certaines images.

La session reste dans MonKado. Un onglet du site public doit être ouvert et connecté : l’extension lui demande les listes et lui transmet l’ajout, sans accéder aux identifiants ni aux jetons. Elle n’ouvre aucune page. Après installation ou mise à jour de l’extension, actualiser cet onglet MonKado pour activer le relais.

## Installation et essai

Version 1.1.1 : ajout de la quantité souhaitée dans les deux modes. Choix d’une personne puis de plusieurs listes pour les idées surprises, avec création directe et photo présélectionnée. Conserve les listes personnelles multiples, le coup de cœur et la détection du prix total sur Amazon. Lors d’une mise à jour manuelle, remplacer les fichiers du dossier chargé dans Chrome par ceux de la nouvelle archive, puis recharger l’extension ; recharger seulement une ancienne copie ne met pas ses fichiers à jour.

Le prix prérempli correspond au prix total de l’article, en excluant les mensualités et les paiements fractionnés détectables. Sur Amazon, le prix principal de l’offre sélectionnée est prioritaire ; les prix barrés et ceux des recommandations ne servent pas de repli. Si aucun prix fiable n’est disponible ou si plusieurs prix principaux se contredisent, le champ reste vide et peut être renseigné manuellement.

1. Déployer le frontend contenant les capacités `supportsQuantities` et `supportsGroupSuggestions` du relais et l’API contenant `POST /api/v1/groups/{groupId}/wishlists/{wishlistId}/suggestion-images/resolve` sur le site public. Sans le nouveau relais, l’extension garde les souhaits personnels et demande d’actualiser MonKado pour les idées surprises.
2. Ouvrir `chrome://extensions`, activer le mode développeur et charger ce dossier avec **Charger l’extension non empaquetée** ; si elle est déjà installée, la recharger.
3. Dans un onglet du site MonKado, se connecter puis actualiser l’onglet. Laisser cet onglet ouvert.
4. Sur une page produit, cliquer sur l’icône MonKado, vérifier les informations, choisir une liste et cliquer sur **Ajouter**.

La version publique du frontend doit être déployée avant d’utiliser ce relais en production. L’extension demande l’accès au site MonKado pour dialoguer avec l’onglet connecté et l’accès temporaire à la page active pour lire le produit. Elle ne stocke aucun identifiant.

## Paquet de production pour les bêta-testeurs

Depuis le dépôt frontend, exécuter `pwsh -File tools/extension/build-beta-extension.ps1` pour produire `.local/MonKado-extension-beta-1.1.1.zip`. Le paquet inclut le guide `INSTALLATION.md`, conserve uniquement le domaine public et vérifie chaque fichier par SHA-256. Le script conserve une copie vérifiée d’une archive précédente avant son remplacement. `-OutputPath` permet aussi de mettre à jour le ZIP bêta de référence, après publication des prérequis du site. Pour revenir à 1.1.0, extraire le précédent ZIP vérifié dans le dossier chargé dans Chrome, recharger l’extension et actualiser MonKado ; les suggestions déjà enregistrées restent conservées.

La distribution manuelle n’effectue aucune mise à jour automatique dans Chrome : les bêta-testeurs remplacent les fichiers du dossier déjà chargé, rechargent l’extension, puis actualisent leur onglet MonKado, comme indiqué dans le guide.

La quantité est validée par le site et l’API avant enregistrement. Une ancienne extension sans quantité conserve la valeur 1. Si le relais ne prend pas encore en charge les quantités, une valeur supérieure à 1 bloque l’envoi avec un message de mise à jour nécessaire, sans création partielle.
