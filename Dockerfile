FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY . .

# Generate Prisma Client
RUN pnpm dlx prisma generate

# Build (if using a build step)
RUN pnpm build

FROM node:20-slim
WORKDIR /app
COPY --from=base /app/package.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma

EXPOSE 3000

# Run migrations then start server
CMD sh -c "npx prisma migrate deploy && node dist/index.js"
