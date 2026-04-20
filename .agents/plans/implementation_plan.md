# Implementation Plan — Central Payments & Auth Service v1.1

**Created:** 2026-04-19  
**Status:** Complete (pending `bun install`)  
**PRD Version:** 1.1.0

---

## Phase 1: Project Scaffolding & Infrastructure

- [x] 1.1 Initialize project (`package.json`)
- [x] 1.2 Configure TypeScript (`tsconfig.json`)
- [x] 1.3 Create `.env.example` and `.gitignore`
- [x] 1.4 Create `Dockerfile`

## Phase 2: Prisma Schema & Database

- [x] 2.1 Write `prisma/schema.prisma` (3 enums + 3 models)
- [x] 2.2 Create Prisma client singleton (`shared/db/prisma.ts`)
- [x] 2.3 Write seed file (`prisma/seed.ts`)

## Phase 3: Shared Infrastructure

- [x] 3.1 `shared/config/env.ts` — Zod-validated env
- [x] 3.2 `shared/api/axios.ts` — Razorpay HTTP client
- [x] 3.3 `shared/utils/response.util.ts`
- [x] 3.4 `shared/middleware/cors.middleware.ts`
- [x] 3.5 `shared/middleware/logger.middleware.ts`
- [x] 3.6 `shared/middleware/rateLimit.middleware.ts`
- [x] 3.7 `shared/middleware/error.middleware.ts` — Prisma-aware
- [x] 3.8 `shared/types/hono.types.ts` + `api.types.ts`

## Phase 4: Auth Feature

- [x] 4.1 `features/auth/types/auth.types.ts`
- [x] 4.2 `features/auth/services/clerk.service.ts`
- [x] 4.3 `features/auth/middleware/clerk.middleware.ts`
- [x] 4.4 `features/auth/api/auth.routes.ts`
- [x] 4.5 `features/auth/index.ts`

## Phase 5: Payments Feature (with Prisma persistence)

- [x] 5.1 `features/payments/types/payments.types.ts`
- [x] 5.2 `features/payments/validators/createOrder.schema.ts`
- [x] 5.3 `features/payments/validators/verifyPayment.schema.ts`
- [x] 5.4 `features/payments/repositories/order.repository.ts`
- [x] 5.5 `features/payments/repositories/payment.repository.ts`
- [x] 5.6 `features/payments/services/order.service.ts`
- [x] 5.7 `features/payments/services/verify.service.ts`
- [x] 5.8 `features/payments/api/payments.routes.ts`
- [x] 5.9 `features/payments/index.ts`

## Phase 6: Webhook Feature (with DB-backed idempotency)

- [x] 6.1 `features/webhook/types/webhook.types.ts`
- [x] 6.2 `features/webhook/repositories/webhookEvent.repository.ts`
- [x] 6.3 `features/webhook/services/webhook.service.ts`
- [x] 6.4 `features/webhook/services/router.service.ts`
- [x] 6.5 `features/webhook/handlers/app1.handler.ts`
- [x] 6.6 `features/webhook/handlers/app2.handler.ts`
- [x] 6.7 `features/webhook/api/webhook.routes.ts`
- [x] 6.8 `features/webhook/index.ts`

## Phase 7: App Bootstrap

- [x] 7.1 `app/index.ts` — Hono init + middleware registration
- [x] 7.2 `app/routes.ts` — Central route registration
- [x] 7.3 `app/server.ts` — Server entry point (Bun native)
- [x] 7.4 `src/index.ts` — Root entry
- [x] 7.5 `Dockerfile`

## Phase 8: Setup & Validation (User Action Required)

- [ ] 8.1 Install Bun: `curl -fsSL https://bun.sh/install | bash`
- [ ] 8.2 Install deps: `bun install`
- [ ] 8.3 Copy env: `cp .env.example .env` (fill in real values)
- [ ] 8.4 Generate Prisma client: `bunx prisma generate`
- [ ] 8.5 Run initial migration: `bunx prisma migrate dev --name init`
- [ ] 8.6 Type check: `bun run typecheck`
- [ ] 8.7 Start dev server: `bun run dev`
