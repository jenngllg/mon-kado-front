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

L’URL doit être absolue et utiliser HTTP ou HTTPS. Vite intègre dans le bundle
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

## Client API

Le client commun est exporté depuis `src/api/index.js`. Il reçoit ses
dépendances afin de rester testable et ne conserve aucun jeton :

```js
import { createApiClient } from "./api/index.js";

const apiClient = createApiClient({
  baseUrl: configuration.apiBaseUrl,
  accessTokenProvider: () => accessToken,
  onUnauthorized: () => clearSession(),
});

const response = await apiClient.request("/api/v1/wishlists", {
  authentication: "required",
});
```

Les modes d’authentification sont :

- `none` : ne lit et n’envoie jamais de JWT ;
- `optional` : ajoute le JWT en mémoire lorsqu’il existe ;
- `required` : interrompt localement l’appel lorsque le JWT est absent.

Les endpoints utilisant un cookie et exigeant l’antiforgery doivent déclarer
`csrf: true`. Le client charge alors `/security/csrf-token`, conserve le jeton
en mémoire et sérialise les chargements concurrents. Après un changement d’état
d’authentification, appeler `refreshCsrfToken()` ; `invalidateCsrfToken()` permet
de supprimer immédiatement le jeton courant.

```js
await apiClient.request("/api/v1/auth/sessions", {
  method: "POST",
  body: credentials,
  csrf: true,
});
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
Seule une erreur antiforgery `400` non structurée peut être rejouée une fois,
après renouvellement du jeton CSRF.

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

Ce dépôt contient le socle frontend, ses fondations graphiques et sa couche HTTP
commune. Les composants d’interface, la navigation, les fonctionnalités métier,
l’intégration continue et le déploiement sont traités dans leurs US dédiées.
