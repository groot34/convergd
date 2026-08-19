FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/server/package.json ./packages/server/package.json
COPY packages/core/package.json ./packages/core/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

WORKDIR /app/packages/server

EXPOSE 3000

CMD ["pnpm", "start"]
