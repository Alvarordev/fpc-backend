FROM node:20-alpine AS base

WORKDIR /app

FROM base AS development

COPY package*.json ./
RUN npm ci

COPY --chown=node:node . .
RUN chown -R node:node /app

USER node

CMD ["npm", "run", "start:dev"]

FROM base AS build

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev \
  && rm -rf node_modules/ts-node node_modules/typescript

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache curl \
  && addgroup -S nestjs \
  && adduser -S nestjs -G nestjs

ENV NODE_ENV=production

COPY --from=build --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nestjs /app/dist ./dist
COPY --from=build --chown=nestjs:nestjs /app/package.json ./package.json

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl --fail http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
