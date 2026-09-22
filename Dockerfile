# The DiaBite engine, packaged for Azure Container Apps.
#
# Runs through tsx rather than compiled JavaScript on purpose: the sources use
# extensionless ESM imports ("./foods"), which tsx resolves and plain Node does
# not. Compiling would mean rewriting every import for no gain here.
#
# The sentence model is fetched at build time (~87 MB) and baked into the image.
# Downloading it on first request instead would make a cold start depend on
# Hugging Face being up, and the first user pay for it.
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first, so a code change does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The engine, the two pure modules it shares with the frontend, and its data.
COPY server ./server
COPY agent/system-prompt.md ./agent/system-prompt.md
COPY src/types.ts ./src/types.ts
COPY src/lib/glycemic.ts ./src/lib/glycemic.ts
COPY src/lib/profile.ts ./src/lib/profile.ts
COPY src/data/foods.ts ./src/data/foods.ts
COPY data/recipes-db/ingredients.json data/recipes-db/recipes_db.json ./data/recipes-db/
COPY data/recipes-db/embeddings.bin data/recipes-db/embeddings.ids.json ./data/recipes-db/
# Warm the model cache in the image. The local .cache is gitignored, so the
# build fetches the model rather than copying it — same result, no 87 MB in git.
RUN node -e "import('@huggingface/transformers').then(async (m) => { m.env.cacheDir = '/app/.cache/transformers'; await m.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' }); console.log('model cached'); })"

# Container Apps injects PORT; 8787 is the local default.
ENV PORT=8787
EXPOSE 8787

USER node
CMD ["npx", "tsx", "server/engine.ts"]
