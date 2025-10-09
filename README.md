# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## GraphQL Code Generation

Type-safe GraphQL queries and mutations are generated using GraphQL Code Generator.

1. Configure environment variables (e.g. in `.env`):

```bash
VITE_API_HUB=http://localhost:8080
```

2. Add / update `.gql` files in `api/hub/queries` or `api/hub/mutations`.

3. Run generation:

```bash
npm run codegen
```

4. Use the typed documents from `api/__generated__/hub-types.ts` (or service‑specific file):

```ts
import { MeDocument } from '@gql-hub';
const data = await hubClient.request(MeDocument);
```

Regenerate after changing the schema or adding new queries.

