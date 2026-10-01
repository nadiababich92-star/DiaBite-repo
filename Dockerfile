# The DiaBite engine, packaged for Azure Container Apps.
#
# Runs through tsx rather than compiled JavaScript on purpose: the sources use
# extensionless ESM imports ("./foods"), which tsx resolves and plain Node does
# not. Compiling would mean rewriting every import for no gain here.
#
# The sentence model is fetched at build time (~87 MB) and baked into the image.
# Downloading it on first request instead would make a cold start depend on
# Hugging Face being up, and the first user pay for it.
# ── the browser app, built once and served by the engine ──────────────────
# One container and one address: the app is served from the same origin as the
# agent it calls, so there is no CORS to configure, no second service to pay
# for, and no laptop running a dev server for the product to be reachable.
FROM node:22-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY index.html vite.config.ts tsconfig.json tsconfig.server.json ./
COPY src ./src
COPY data/recipes-db/ingredients.json data/recipes-db/recipes_db.json ./data/recipes-db/
# In dev, Vite proxies /agent to the engine's /agent/ask. Served from the
# engine there is no proxy, so the path is the real one.
ENV VITE_AGENT_URL=/agent/ask
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_PUBLISHABLE_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

# ── the engine ────────────────────────────────────────────────────────────
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first, so a code change does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The engine, the two pure modules it shares with the frontend, and its data.
COPY server ./server
COPY agent/prompts ./agent/prompts
COPY src/types.ts ./src/types.ts
COPY src/lib/glycemic.ts ./src/lib/glycemic.ts
COPY src/lib/profile.ts ./src/lib/profile.ts
# Shared with the browser: the allergen and eating-pattern rules the engine
# filters suggestions with. Copying files one by one keeps the image small and
# makes a forgotten one a crash at boot rather than a wrong answer later.
COPY src/lib/dietary.ts ./src/lib/dietary.ts
COPY src/data/foods.ts ./src/data/foods.ts
COPY data/recipes-db/ingredients.json data/recipes-db/recipes_db.json ./data/recipes-db/
# The coverage layer: USDA's "foods as eaten", which is what someone types
# into a diary. 7 MB next to an 87 MB model.
COPY data/foods-usda/foods_usda.json ./data/foods-usda/
COPY data/recipes-db/embeddings.bin data/recipes-db/embeddings.ids.json ./data/recipes-db/
# Warm the model cache in the image. The local .cache is gitignored, so the
# build fetches the model rather than copying it — same result, no 87 MB in git.
RUN node -e "import('@huggingface/transformers').then(async (m) => { m.env.cacheDir = '/app/.cache/transformers'; await m.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' }); console.log('model cached'); })"

COPY --from=web /app/dist ./dist

# Container Apps injects PORT; 8787 is the local default.
ENV PORT=8787
EXPOSE 8787

USER node
CMD ["npx", "tsx", "server/engine.ts"]
