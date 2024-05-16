ARG NODE_VERSION=19-alpine
FROM node:${NODE_VERSION} AS base
RUN npm install -g pnpm

FROM base AS builder
WORKDIR /usr/srv/app

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .

RUN pnpm prisma generate && pnpm build

FROM base AS runner
WORKDIR /usr/srv/app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /usr/srv/app/package.json /usr/srv/app/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder --chown=node:node /usr/srv/app/build ./

RUN chown node:node .
USER node

CMD ["node", "server.js"]