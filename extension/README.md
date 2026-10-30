# Extension Chrome MonKado

L’extension utilise les comptes et listes du site public `https://www.monkado.fr`. Elle lit les informations disponibles directement dans la page produit au clic sur son icône. Aucun appel d’analyse de lien n’est effectué. Le nom et le prix restent modifiables. Elle propose jusqu’à douze photos détectées ; l’utilisateur peut en choisir une ou continuer sans image.

Les miniatures proviennent des adresses d’images indiquées par la page. Lorsqu’une photo est choisie, l’extension essaie de la lire depuis l’onglet produit, sans cookies ni nouvelle demande d’autorisation, puis la redimensionne avant l’envoi à MonKado. Si cette lecture échoue, MonKado tente de récupérer uniquement l’image choisie avec son transport sécurisé. Certains sites peuvent empêcher sa récupération.

La session reste dans MonKado. Un onglet du site public doit être ouvert et connecté : l’extension lui demande les listes et lui transmet l’ajout, sans accéder aux identifiants ni aux jetons. Elle n’ouvre aucune page. Après installation ou mise à jour de l’extension, actualiser cet onglet MonKado pour activer le relais.

## Installation et essai

1. Déployer le frontend contenant le relais de session sur le site public.
2. Ouvrir `chrome://extensions`, activer le mode développeur et charger ce dossier avec **Charger l’extension non empaquetée** ; si elle est déjà installée, la recharger.
3. Dans un onglet du site MonKado, se connecter puis actualiser l’onglet. Laisser cet onglet ouvert.
4. Sur une page produit, cliquer sur l’icône MonKado, vérifier les informations, choisir une liste et cliquer sur **Ajouter**.

La version publique du frontend doit être déployée avant d’utiliser ce relais en production. L’extension demande l’accès au site MonKado pour dialoguer avec l’onglet connecté et l’accès temporaire à la page active pour lire le produit. Elle ne stocke aucun identifiant.
