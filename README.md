# MonKado Front

Frontend web de MonKado, construit avec JavaScript, les modules ES et Vite.

## Prérequis

- Node.js 24 LTS
- pnpm 11

La version Node attendue est indiquée dans `.nvmrc`. Le champ `packageManager`
de `package.json` fixe la version de pnpm utilisée par le projet.

Avec un gestionnaire compatible avec `.nvmrc` et Corepack :

```shell
nvm use
corepack enable
corepack prepare pnpm@11.19.0 --activate
```

## Installation

```shell
pnpm install --frozen-lockfile
```

## Configuration locale

Copier `.env.example` vers `.env.local` :

```shell
cp .env.example .env.local
```

Sous PowerShell :

```powershell
Copy-Item .env.example .env.local
```

La variable publique suivante est obligatoire :

```dotenv
VITE_API_BASE_URL=http://localhost:7000
```

L’URL doit être absolue et utiliser HTTP ou HTTPS, sans identifiants intégrés.
Vite intègre dans le bundle
toutes les variables préfixées par `VITE_` : elles sont donc publiques et ne
doivent jamais contenir de mot de passe, de jeton ou un autre secret.

## Développement

```shell
pnpm dev
```

L’application est ensuite accessible sur <http://localhost:5173>.

## Fondations graphiques

L’interface utilise Nunito Sans, chargée localement depuis les dépendances du
projet. Le thème clair reprend la direction des maquettes MonKado : fond ivoire,
surfaces sauge, texte vert forêt et accent corail.

Les actions corail utilisent `--color-text-on-accent` (vert sombre) et les
petits textes corail `--color-accent-text` pour respecter un contraste de
4,5:1. Les contours de contrôle et de focus visent au moins 3:1. Les animations
et transitions sont supprimées avec `prefers-reduced-motion: reduce`.

Les styles sont organisés en couches CSS afin de conserver un ordre de priorité
prévisible : `reset`, `tokens`, `base`, `layout`, `components` et `utilities`.
Les variables publiques suivent les familles suivantes :

- `--color-*` pour les couleurs sémantiques ;
- `--font-*` et `--line-height-*` pour la typographie ;
- `--space-*` pour les espacements ;
- `--radius-*` et `--shadow-*` pour les surfaces ;
- `--content-*` pour les largeurs et gouttières de page.

Les mises en page sont mobiles-first, supportent les écrans à partir de 320 px
et privilégient les dimensions fluides. Les primitives disponibles sont :

- `.container`, avec les variantes `.container--regular` et
  `.container--narrow` ;
- `.flow` pour le rythme vertical, personnalisable avec `--flow-space` ;
- `.cluster` pour les groupes flexibles, personnalisable avec
  `--cluster-space` ;
- `.responsive-grid` pour une grille fluide, personnalisable avec
  `--grid-min-width` et `--grid-space` ;
- `.visually-hidden` et `.break-anywhere` pour les besoins d’accessibilité et
  de contenu non sécable.

Les animations sont automatiquement neutralisées lorsque l’utilisateur active
la préférence système de réduction des mouvements.

## Shell applicatif

Le shell persistant est créé avec `createApplicationShell()` depuis
`src/app/index.js`. Il fournit l’élément racine, le `main` utilisé comme
outlet du routeur, la région de notifications, une zone d’alerte de session,
`setCurrentRoute()` et `setSession()` pour synchroniser la navigation.

L’en-tête contient la marque MonKado. Un visiteur voit Accueil, Connexion et
S’inscrire ; un membre voit Accueil, Mes listes, Mes réservations, Mon profil
et Se déconnecter. Pendant la restauration, les actions de compte sont
remplacées par une indication de chargement. À partir de `48rem`, ces
liens sont affichés horizontalement. Sur les écrans plus étroits, ils sont
regroupés dans un menu déroulant utilisable au clavier et refermé après chaque
navigation. Un lien d’évitement permet d’atteindre directement le contenu.

`createApplicationRoutes({ session })` centralise les routes réservées aux prochaines
fonctionnalités : compte, confirmation d’e-mail, profil, listes, réservations
et partage invité. Tant que leur US n’est pas développée, chaque route affiche
une page temporaire explicite sans formulaire, donnée fictive ni appel API
métier. Les appels de restauration de session sont centralisés au démarrage.

Les futurs liens invités utiliseront la forme
`/shared-wishlists/{shareLinkId}#{secret}`. Le fragment contient le secret :
il ne doit être ni rendu dans la page, ni journalisé, ni déplacé dans la query
string. L’alignement des anciennes redirections backend utilisant `/#/` sera
effectué dans les US d’authentification et de partage.

## Composants communs

Les factories exportées par `src/components/index.js` retournent directement
des éléments DOM et n’interprètent jamais de chaîne comme du HTML. La
bibliothèque fournit :

- `createButton()` et `setButtonLoading()` ;
- `createActionLink()` ;
- `createFormField()`, `createValidationMessage()` et
  `setFormFieldValidation()` ;
- `createAlert()`, `createEmptyState()` et `createLoadingState()` ;
- `createNotificationRegion()`, `showNotification()` et
  `dismissNotification()`.

Les notifications d’information et de succès disparaissent après cinq
secondes. Les avertissements restent huit secondes et les erreurs restent
affichées jusqu’à leur fermeture. Le compte à rebours est suspendu tant que la
notification est survolée ou contient le focus.

Tout composant enregistrant un événement ou un timer inscrit son nettoyage dans
un registre commun. Appeler `disposeComponent(element)` avant d’abandonner un
sous-arbre DOM libère récursivement ces ressources sans retirer l’élément :

```js
import {
  createButton,
  disposeComponent,
} from "./components/index.js";

const button = createButton({
  label: "Créer une liste",
  onClick: () => openCreateWishlist(),
});

disposeComponent(button);
button.remove();
```

## Navigation frontend

Le routeur SPA commun est exporté depuis `src/router/index.js`. Il utilise la
History API et conserve des URLs propres sans dépendance externe. Une route
nommée fournit un chemin, un titre et une factory retournant un élément DOM,
directement ou dans une promesse :

```js
import { createRouter } from "./router/index.js";

const router = createRouter({
  outlet: document.querySelector("#app"),
  routes: [
    {
      name: "home",
      path: "/",
      title: "MonKado",
      render: () => createHomeView(),
    },
  ],
  renderNotFound: () => createNotFoundView(),
  renderError: (error) => createErrorView(error),
});

await router.start();
```

Les chemins acceptent les paramètres obligatoires comme
`/lists/:listId`. La factory reçoit l’URL, les paramètres décodés, la query
string, un `AbortSignal` et la fonction `navigate()`. Une garde
`beforeEnter()` peut être synchrone ou asynchrone et rediriger en retournant
`{ redirectTo: "/login" }`. Une redirection remplace l’entrée courante par
défaut ; définir `replace: false` ajoute une nouvelle entrée à l’historique.

Le routeur intercepte uniquement les liens de même origine compatibles avec
une navigation SPA. Les liens externes, téléchargements, fragments locaux,
clics modifiés et liens avec une autre cible restent gérés par le navigateur.

`subscribe()` retourne une fonction de désabonnement idempotente. `dispose()`
annule la navigation active, retire les écouteurs et libère récursivement les
ressources de la vue avec `disposeComponent()`, sans retirer son DOM.

En production, l’hébergement doit renvoyer `index.html` pour tout chemin qui ne
correspond pas à un fichier statique afin que les accès directs et le
rafraîchissement d’une route soient pris en charge. Cette règle sera appliquée
par la configuration de déploiement de l’US dédiée.

## Client API

Le transport commun est exporté depuis `src/api/index.js`. Il reçoit ses
dépendances afin de rester testable et ne conserve aucun jeton. Dans les
fonctionnalités, utiliser la façade du gestionnaire de session injecté, et ne
pas créer un client indépendant pour les opérations authentifiées :

```js
const response = await session.request("/api/v1/wishlists", {
  authentication: "required",
});
```

Les modes d’authentification du transport bas niveau sont :

- `none` : ne lit et n’envoie jamais de JWT ;
- `optional` : ajoute le JWT en mémoire lorsqu’il existe ;
- `required` : interrompt localement l’appel lorsque le JWT est absent.

Les endpoints utilisant un cookie et exigeant l’antiforgery doivent déclarer
`csrf: true`. Le client charge alors `/security/csrf-token`, conserve le jeton
en mémoire et sérialise les chargements concurrents. Après un changement d’état
d’authentification, appeler `refreshCsrfToken()` ; `invalidateCsrfToken()` permet
de supprimer immédiatement le jeton courant.

```js
await session.establishSession(({ request }) =>
  request("/api/v1/auth/sessions", { method: "POST", body: credentials }),
);
```

Les options `ifMatch` et `shareToken` alimentent exclusivement les en-têtes
`If-Match` et `X-MonKado-Share-Token`. Les chemins absolus, externes ou avec un
fragment sont refusés pour éviter toute fuite de secret.

Les réponses réussies exposent `data`, `status` et `metadata`. Une erreur HTTP,
réseau, de timeout ou de format produit une `ApiError` sans corps de requête ni
en-tête sensible. `toUserFacingError()` fournit un message français sûr et
accepte un catalogue propre à chaque fonctionnalité. Le texte anglais du
backend n’est jamais présenté directement.

Le client ne rejoue pas automatiquement les erreurs réseau, `429` ou `5xx`.
Son option interne `accessTokenVersionProvider` fournit une révision numérique
opaque : le hook `onUnauthorized` ignore les réponses d’un ancien JWT, sans
exposer ce JWT au hook ni utiliser son expiration comme identité de requête.
Le délai couvre aussi la lecture du corps de réponse. Les redirections HTTP
sont refusées pour empêcher tout transfert des en-têtes de partage ou CSRF.
Seule une erreur antiforgery `400` non structurée peut être rejouée une fois,
après renouvellement du jeton CSRF.

`router.presentError()` ne réutilise comme traduction que les objets produits
par `toUserFacingError()` ; un objet brut est toujours normalisé. Les liens
d’action acceptent uniquement HTTP, HTTPS, `mailto:`, `tel:` et les liens
relatifs. L’état natif `button.disabled` avant chargement est restauré à la fin.

## Session utilisateur et accès protégés

`createSessionManager()` est exporté depuis `src/auth/index.js`. La composition
`createSessionApplication()` crée une seule instance et la partage entre le
routeur, le shell et les futures fonctionnalités. Le transport `fetch`,
l’horloge `now` et le coordinateur sont injectables pour les tests.

```js
import { createSessionManager } from "./auth/index.js";

// Dans la composition de l’application uniquement, pas dans chaque vue.
const session = createSessionManager({ apiBaseUrl: configuration.apiBaseUrl });
const unsubscribe = session.subscribe(state => updateAccountNavigation(state));
await session.start();
const response = await session.request("/api/v1/wishlists", {
  authentication: "required",
  signal: viewAbortController.signal,
});

// À la destruction de la composition :
unsubscribe();
session.dispose();
```

L’API publique expose :

- `start()` : restauration initiale idempotente ; `restore()` : tentative
  explicite ou attente du travail déjà en cours. Ces méthodes retournent
  l’instantané, y compris en cas de session anonyme ou indisponible.
- `ensureSession({ signal })` : attend une session utilisable, renouvelle si
  nécessaire et retourne son état. Une indisponibilité lève une `ApiError` ;
  un visiteur connu anonyme reste anonyme.
- `request(path, options)` : conserve les options et réponses du transport.
  `none` n’effectue aucun renouvellement ; `required` exige une session ;
  `optional` autorise un visiteur connu anonyme mais ne masque jamais une
  indisponibilité par un appel anonyme.
- `establishSession(authenticate, { signal } = {})` : exécute un appel JSON de connexion
  sous le verrou commun. La fonction reçoit `{ request }`, avec authentification
  `none` et CSRF imposés, et retourne une réponse `AccessTokenResponse` normalisée.
  Elle ne doit ni rappeler le gestionnaire de session ni effectuer un second
  renouvellement. Le gestionnaire charge ensuite l’identité et publie la session.
  Les échecs sont levés sous forme sûre. Avant l’envoi, le signal annule l’attente
  du verrou et abandonne la connexion ; une préparation CSRF déjà engagée termine
  sous le verrou sans envoyer le mot de passe. Après l’envoi, le signal annule uniquement l’attente
  de l’appelant. Le gestionnaire termine la finalisation sous le même verrou.
- `getSnapshot()` et `subscribe(listener)` : instantanés immuables, notification
  immédiate et désabonnement idempotent.
- `logout()` : ferme immédiatement l’accès local puis tente la déconnexion
  serveur ; son résultat indique `logoutPending` si une confirmation manque.
- `dispose()` : efface les données privées, annule les consommateurs et nettoie
  les abonnements, événements, verrous en attente et ressources de coordination.

Les états sont `initializing`, `anonymous`, `authenticated`, `unavailable` et
`signingOut`. Seuls l’utilisateur validé, l’ETag de son identité, le marqueur
`logoutPending`, le booléen `authenticationPending` et un message français sûr sont exposés. Le JWT reste privé,
en mémoire dans chaque onglet ; l’identité vient de
`GET /api/v1/auth/sessions/current`, jamais des claims décodés du JWT.

La restauration utilise `POST /api/v1/auth/sessions/refresh` avec CSRF et le
cookie HttpOnly géré par le backend. Le JWT est renouvelé à l’usage, à moins
de 60 secondes de son expiration annoncée par `expiresIn`. Il n’existe aucun
renouvellement périodique pendant l’inactivité. Les appels concurrents d’un
onglet partagent la même tentative ; annuler une attente n’annule pas la
rotation commune. Un `401` du JWT courant ferme la session, sans refresh ni
rejeu de l’opération. Un `401` initial sans cookie est un état anonyme normal.

Les routes `/profile`, `/lists`, `/lists/new`, `/lists/:listId` et
`/reservations` sont protégées. Les gardes attendent la restauration, puis
redirigent les visiteurs anonymes avec `replace` vers `/login?returnTo=...`.
`getSafeReturnTo()` conserve uniquement un chemin protégé interne, sans query
string ni fragment ; la destination par défaut est `/lists`. Les utilisateurs
connectés sont redirigés de `/login` et `/register` vers `/lists`. Les autres
routes restent publiques, notamment confirmations, récupération, liaison Google,
partage invité et 404. Une panne affiche Réessayer, pas une fausse déconnexion.

### Plusieurs onglets et déconnexion

Web Locks sérialise les mutations du cookie entre onglets de la même origine,
avec 30 secondes maximum d’attente du verrou, sans prise forcée. BroadcastChannel
n’annonce que les changements de session et les intentions de déconnexion.
IndexedDB conserve exclusivement `{ generation, logoutPending }` dans un espace
de noms lié à l’origine de l’API. Aucun jeton, profil, secret ou URL n’y est écrit ;
aucun JWT n’est échangé entre onglets. Une nouvelle identité provoque une
restauration indépendante dans les autres onglets. Les générations sont aussi
vérifiées avant les opérations protégées, après leurs réponses et au retour
d’un onglet suspendu. Les résultats obsolètes sont abandonnés.

La déconnexion efface immédiatement les credentials et retire les vues privées.
Son intention est persistée indépendamment du verrou réseau ; le `DELETE`
attend ensuite la fin d’une rotation engagée. Si le serveur ne confirme pas,
l’alerte « Déconnexion serveur non confirmée » propose Réessayer. Le blocage
survit au rechargement et à l’ouverture d’un nouvel onglet, jusqu’à confirmation
serveur ou nouvelle connexion explicitement demandée et réussie. Le navigateur
ne peut pas supprimer lui-même le cookie HttpOnly. Effacer les données du site
supprime aussi le marqueur local : ce mécanisme ne remplace pas la révocation
côté serveur, ne révoque pas instantanément les JWT déjà émis et ne déconnecte
pas les autres appareils.

Les navigateurs doivent fournir Web Locks, BroadcastChannel, IndexedDB et
AbortSignal.any, dans un contexte sécurisé (HTTPS ou localhost). Si la
coordination ou le stockage est indisponible, la session échoue de manière
explicite ; les pages publiques restent utilisables. Il n’existe aucun fallback
vers des refresh concurrents non protégés.

En local, ouvrir **http://localhost:5173** avec une API
**http://localhost:7000**, sans mélanger `127.0.0.1` et `localhost` : les cookies
`SameSite=Strict` exigent une topologie compatible. Les ports Vite restent
inchangés. En déploiement, prévoir HTTPS, des origines compatibles avec la
politique SameSite du backend et le CORS avec credentials. Les gardes frontend
ne remplacent jamais les contrôles d’autorisation du backend.

Les tests de session utilisent des frontières injectables et une horloge
simulée ; les intégrations DOM utilisent Happy DOM. Les vérifications réelles
multi-onglets Playwright sont temporaires et ne constituent pas une suite E2E
installée dans ce dépôt.

## Inscription (#865)

`/register` propose un nom d’affichage, une adresse e-mail et un mot de passe.
La vue `createRegistrationView({ register, signal })` utilise les composants
communs ; son service injectable `createRegistrationService(session)` envoie
uniquement `{ displayName, email, password }` à `POST /api/v1/auth/registrations`,
avec CSRF et `authentication: "none"`. Le payload est typé avec le schéma
OpenAPI `RegisterAccountRequest`. Aucun JWT, refresh ou établissement de session
n’est déclenché par cette opération. La restauration globale du shell reste indépendante.

Le nom et l’e-mail sont nettoyés aux extrémités ; le mot de passe reste strictement
inchangé. Les limites (80, 254 et 12–128) comptent les caractères Unicode, pas les
unités UTF-16. Le navigateur vérifie les erreurs de saisie évidentes ; le backend
reste l’arbitre du format d’e-mail. Les validations et erreurs affichées sont
françaises, jamais issues des messages anglais du serveur.

Seul un `202 Accepted` sans corps confirme la prise en compte. L’option HTTP
`expectEmptyResponse: true` distingue un corps vide d’un JSON `null`, sans
changer la forme des réponses normalisées ni les autres appels. Le formulaire
est alors effacé et remplacé sur la même route par un message neutre, identique
pour une adresse nouvelle ou déjà inscrite : ni existence du compte, ni envoi
effectif d’e-mail ne sont affirmés. Il faut confirmer l’adresse avant de se
connecter. Confirmation effective, renvoi d’e-mail, connexion et Google restent
dans leurs US respectives.

En cas d’échec, les saisies restent uniquement dans le formulaire monté.
Le délai éventuel d’un `429` est indiqué, sans rejeu automatique. La sortie de
la vue annule l’appel, efface les champs et nettoie les événements ; une réponse
tardive est ignorée. Une connexion dans un autre onglet ferme ce formulaire
et remplace l’URL par `/lists`. Aucun champ n’est stocké ou journalisé.

## Confirmation d’adresse e-mail (#866)

Le lien émis par le backend est `/confirm-email#userId={userId}&token={token}`.
La page publique confirme automatiquement un lien valide, sans connexion
automatique ni modification de la session ouverte. Sans fragment, elle propose
le formulaire de renvoi ; un lien malformé ou rejeté affiche une alerte et ce
même formulaire. `/confirm-email-change` reste un parcours distinct, non développé ici.

`createEmailConfirmationService(session)` expose `confirm({ userId, token },
{ signal })` et `resend({ email }, { signal })`. Les deux utilisent `session.request`,
CSRF, `authentication: "none"` et `expectEmptyResponse: true`. Les contrats
OpenAPI sont consommés en JSDoc : `ConfirmEmailRequest` (succès `204`) et
`RequestEmailConfirmationRequest` (succès `202`). Aucun appel supplémentaire
de restauration ou d’établissement de session n’est déclenché par ces opérations.

`createEmailConfirmationView({ confirm, resend, consumeFragment, signal })`
consomme immédiatement le fragment via le contexte du routeur. La méthode
`consumeFragment()` retourne le fragment avec son `#`, puis le supprime par
`history.replaceState`, sans nouvelle navigation ; un deuxième appel retourne
une chaîne vide. Les URLs du contexte et de l’instantané du routeur sont aussi
nettoyées. Une ancienne navigation ne peut plus consommer le fragment courant.
Les autres routes conservent leurs fragments tant qu’elles ne les consomment pas.

Le jeton reste uniquement en mémoire pendant l’appel ou une erreur récupérable.
Il est abandonné après succès, rejet définitif, passage au renvoi ou destruction
de la vue. Il n’est jamais injecté dans le DOM, les logs, les erreurs, les
stockages ou `history.state`. Recharger l’URL nettoyée affiche le renvoi : pour
retenter la confirmation, rouvrir le lien d’origine. Les échecs techniques
proposent Réessayer ; seul le rejeu antiforgery du client HTTP reste automatique.

Le renvoi réutilise la validation e-mail de l’inscription. Son résultat est
volontairement neutre pour un compte inconnu, déjà confirmé ou soumis aux quotas :
un `202` ne garantit pas qu’un e-mail a été envoyé. L’adresse saisie est effacée
après acceptation et à la sortie du formulaire. « Utiliser une autre adresse »
réaffiche un formulaire vide. Un `429` affiche son délai éventuel, sans minuterie
ni soumission automatique. Les messages anglais du backend ne sont jamais affichés.

## Connexion e-mail et mot de passe

`/login` utilise les composants communs avec e-mail, mot de passe, affichage
facultatif du mot de passe et case native « Se souvenir de moi » décochée.
Les gestionnaires de mots de passe et le collage restent utilisables :
`autocomplete="username"` et `autocomplete="current-password"`.
L’e-mail réutilise la validation commune (nettoyage des extrémités et maximum
254 caractères Unicode). Un mot de passe existant doit être non blanc et ne
pas dépasser 128 caractères Unicode, sans minimum de 12 caractères.
Il n’est jamais tronqué, normalisé ni nettoyé avant l’envoi.

`createLoginService(session)` appelle exclusivement `establishSession()` :
`POST /api/v1/auth/sessions` avec le seul corps `{ email, password, rememberMe }`,
sans JWT et avec CSRF. Le transport conserve cookies, timeout et unique rejeu
antiforgery ; aucun retry réseau ou HTTP n’est ajouté. `rememberMe` ne change que
le cookie backend : session navigateur par défaut, expiration fixe de 30 jours
si coché. Aucun identifiant ni choix de persistance n’est enregistré côté front.

Un 200 et un `AccessTokenResponse` valide marquent l’acceptation des identifiants :
le mot de passe est effacé du formulaire et la génération précédente invalidée.
Le gestionnaire conserve le jeton candidat uniquement en mémoire et ne publie
la session connectée qu’après `GET /api/v1/auth/sessions/current`, statut 200,
identité valide et ETag fort. L’instantané indique `authenticationPending`
pendant cette finalisation, sans jamais exposer le jeton.

Si cette lecture échoue techniquement, « Réessayer la vérification de session »
appelle `restore()` : réutilisation du candidat utilisable, sinon renouvellement
coordonné, puis relecture de l’identité. Le POST et le mot de passe ne sont pas
renvoyés. Un 401 de finalisation abandonne le candidat et demande une nouvelle
connexion explicite. Une déconnexion en attente n’est levée qu’après finalisation
réussie ; son avertissement persistant reste distinct des erreurs du formulaire.

La redirection après connexion appartient à l’intégration session/routeur :
`replace` vers l’unique `returnTo` interne protégé validé, ou `/lists` s’il est absent,
dupliqué ou invalide. Query string et fragment de la destination sont supprimés.
Un utilisateur déjà connecté arrivant sur `/login` va directement vers `/lists`.
Une connexion dans un autre onglet nettoie le formulaire et respecte la même
destination. Si l’utilisateur quitte la page pendant l’envoi, tous ses champs
sont effacés ; la session peut se finaliser en arrière-plan, sans redirection tardive.
Une déconnexion ou un changement de génération rend les anciens résultats caducs.

Les erreurs de tentative restent dans la vue, avec messages français locaux,
référence technique et délai `Retry-After` éventuel. L’adresse non confirmée
propose `/confirm-email` sans e-mail dans l’URL ni renvoi automatique.
La récupération du mot de passe et Google restent dans leurs US dédiées.

## Profil utilisateur

La route protégée `/profile` affiche l’adresse e-mail en lecture seule et permet
de modifier uniquement le nom d’affichage (80 caractères Unicode maximum).
Sa validation est partagée avec l’inscription. Les changements d’e-mail et de
mot de passe restent dans leurs US dédiées.

`session.refreshIdentity({ signal })` relit `GET /api/v1/auth/sessions/current`,
valide l’identité et son ETag fort puis publie un instantané immuable. Elle utilise
le renouvellement à l’usage existant, sans rotation supplémentaire si le JWT est
encore utilisable. Une panne de lecture ne déconnecte pas l’utilisateur ; un 401
conserve le traitement d’expiration existant. Les lectures obsolètes ou appartenant
à une ancienne session ne peuvent pas publier de données.

L’enregistrement appelle `PUT /api/v1/members/current/profile` avec le seul
champ `displayName`, le JWT et l’ETag de la version éditée dans `If-Match`.
Le succès attendu est un 200 avec le nom enregistré et un ETag fort. Une relecture
actualise ensuite l’identité centralisée. Si elle échoue, l’interface distingue
l’enregistrement réussi de l’actualisation échouée et ne propose de rejouer que
la lecture ; une nouvelle écriture reste bloquée jusque-là.

Un conflit 412 conserve la saisie et recharge la dernière version pour comparaison.
L’utilisateur choisit explicitement d’enregistrer sa saisie avec le nouvel ETag
ou d’utiliser la valeur serveur. Aucun écrasement ni rejeu automatique de PUT,
et jamais de précondition générique `If-Match: *`.

Les brouillons ne vivent que dans la vue montée et sont abandonnés à sa fermeture.
Aucune donnée de profil n’est stockée durablement ni diffusée entre onglets.
Un autre onglet relit le profil à l’ouverture de la page ou lors d’un conflit.
La déconnexion retire immédiatement le contenu protégé et annule ses opérations.

## Types du contrat OpenAPI

Le backend doit exposer son contrat OpenAPI v1. L’URL utilisée par défaut est
`http://localhost:7000/openapi/v1.json`. Pour utiliser un autre environnement,
définir `MONKADO_OPENAPI_URL` avant la commande :

```powershell
$env:MONKADO_OPENAPI_URL = "http://localhost:8080/openapi/v1.json"
pnpm api:types
```

Cette variable configure uniquement l’outil Node. Elle n’est pas préfixée par
`VITE_` et n’est donc jamais intégrée au bundle navigateur. L’URL doit être
absolue, utiliser HTTP ou HTTPS et ne pas contenir d’identifiants. Le
téléchargement expire après 30 secondes et n’est jamais rejoué automatiquement.

La génération produit `src/api/generated/openapi.d.ts`, qui est versionné et
ne doit pas être modifié manuellement :

```shell
pnpm api:types
pnpm api:types:check
```

La seconde commande ne modifie aucun fichier. Elle échoue si le fichier est
absent ou si le contrat et les types versionnés diffèrent. Les types sont
utilisables depuis JavaScript avec JSDoc, sans import runtime :

```js
/** @typedef {import("./api/generated/openapi.js").components["schemas"]["ErrorResponse"]} ErrorResponse */
```

La génération fournit exclusivement des déclarations TypeScript. Le client
HTTP commun reste écrit et contrôlé manuellement.

## Contrôles qualité

```shell
pnpm lint
pnpm typecheck
pnpm test
```

## Build de production

```shell
pnpm build
pnpm preview
```

Le build statique est généré dans `dist/`. La commande `preview` le rend
accessible localement sur <http://localhost:5173>.

## Périmètre actuel

Ce dépôt contient le socle frontend, ses fondations graphiques, ses composants
communs, son routeur, son shell applicatif et sa couche HTTP. Les fonctionnalités
métier, l’intégration continue et le déploiement sont traités dans leurs US
dédiées.
