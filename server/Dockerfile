# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    DATABASE_URL_UNPOOLED="postgresql://dummy:dummy@localhost:5432/dummy" \
    npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# ── Stage 2: runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

COPY --from=builder /app/src/generated ./dist/generated

COPY prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/index.js"]