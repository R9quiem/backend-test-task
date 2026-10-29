FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node docs ./docs

RUN mkdir -p /app/data \
    && chown node:node /app/data

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]