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

Ce dépôt contient uniquement le socle du frontend. Le design system, la
navigation, le client API, l’intégration continue et le déploiement seront
ajoutés dans les US suivantes.
