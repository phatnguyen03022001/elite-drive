FROM node:24-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx nest build \
    && npm prune --omit=dev

FROM base AS runtime

ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

RUN mkdir -p /app/uploads \
    && chown node:node /app/uploads

USER node

EXPOSE 8000

CMD ["node", "dist/main"]
