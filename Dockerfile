# Coolify: Dockerfile build pack, port 3000, domain https://babafeqi.raafat.site
# Mark VITE_* env vars as available at build time in Coolify.
# Pin bun to the lockfile's version — oven/bun:1 floated to 1.4 and failed
# IntegrityCheckFailed extracting @eslint/eslintrc.
FROM oven/bun:1.3.14 AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV NITRO_PRESET=node-server

RUN bun run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
