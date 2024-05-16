ARG NODE_VERSION=19-alpine

FROM node:${NODE_VERSION} AS builder
WORKDIR /usr/srv/app

RUN npm install -g pnpm

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod=false && pnpm prisma generate

COPY --chown=node:node . .

RUN pnpm build

FROM node:${NODE_VERSION} AS runner
WORKDIR /usr/srv/app
ENV NODE_ENV=production

RUN npm install -g pnpm

COPY --from=builder --chown=node:node /usr/srv/app/package.json /usr/srv/app/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod && pnpm prisma generate

COPY --from=builder --chown=node:node /usr/srv/app/build ./

RUN chown node:node .
USER node

CMD ["node", "server.js"]