FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ai/package.json ./packages/ai/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

WORKDIR /app/packages/ai

EXPOSE 4000

CMD ["pnpm", "start"]
