# 📄 Product Requirements Document (PRD)

# Central Payments & Auth Service

**Version:** 1.1.0  
**Status:** Active  
**Last Updated:** 2025  
**Authors:** Engineering Team  
**Stack:** Hono · Razorpay · Clerk · Zod · Axios · Prisma · PostgreSQL · TypeScript

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Tech Stack & Justification](#4-tech-stack--justification)
5. [System Architecture](#5-system-architecture)
6. [Folder Structure (Feature-First + Clean Architecture)](#6-folder-structure)
7. [Environment Configuration](#7-environment-configuration)
8. [Middleware Layer](#8-middleware-layer)
9. [Feature: Auth (Clerk Integration)](#9-feature-auth)
10. [Feature: Payments (Razorpay)](#10-feature-payments)
11. [Feature: Webhooks](#11-feature-webhooks)
12. [Shared Infrastructure](#12-shared-infrastructure)
13. [Database Layer (Prisma + PostgreSQL)](#13-database-layer)
14. [API Contract (Full Reference)](#14-api-contract)
15. [Data Flow Diagrams](#15-data-flow-diagrams)
16. [Error Handling Strategy](#16-error-handling-strategy)
17. [Security Requirements](#17-security-requirements)
18. [Validation Strategy (Zod)](#18-validation-strategy)
19. [Logging & Observability](#19-logging--observability)
20. [Testing Strategy](#20-testing-strategy)
21. [Deployment & DevOps](#21-deployment--devops)
22. [Future Enhancements](#22-future-enhancements)
23. [Success Criteria](#23-success-criteria)
24. [Design Decisions Log](#24-design-decisions-log)
25. [Glossary](#25-glossary)

---

## 1. Executive Summary

The **Central Payments & Auth Service** is a unified backend service built with **Hono** that consolidates all Razorpay payment flows, webhook handling, Clerk-based authentication, and **persistent payment state** across multiple client applications (web and mobile).

This service acts as the **single source of truth** for the entire payment lifecycle — from order creation through to webhook processing — backed by a **Prisma-managed PostgreSQL database** that provides a durable audit trail, DB-backed idempotency for webhooks, and queryable payment history for all connected apps.

**v1.1 adds Prisma**, replacing all in-memory state with persistent, production-safe storage across three core tables: `orders`, `payments`, and `webhook_events`.

---

## 2. Problem Statement

### Current State (Before This Service)

| Problem                                                      | Impact                                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Each frontend app has its own Razorpay integration           | Duplicate logic, inconsistent implementations                              |
| Payment signature verification done client-side in some apps | Critical security vulnerability                                            |
| No centralized webhook handler                               | Events get missed or processed multiple times                              |
| Clerk JWT verified differently per app                       | Inconsistent user identity, auth bugs                                      |
| No unified logging for payment events                        | Debugging is slow and incomplete                                           |
| Multiple Razorpay credentials scattered across apps          | Secret sprawl, rotation nightmares                                         |
| **No persistent payment record**                             | Payment data lost on service restart; no audit trail                       |
| **In-memory webhook idempotency**                            | Deduplication resets on every deploy or restart — events reprocessed       |
| **No queryable payment history**                             | Cannot answer "did user X pay for product Y?" without hitting Razorpay API |

### Root Cause

There is no shared backend layer that owns the full payment lifecycle **and persists that state durably**: order creation → checkout → verification → webhook → post-payment action → stored record.

---

## 3. Goals & Non-Goals

### Goals

- Build a single Hono-based service that owns all Razorpay interactions
- Validate all Clerk JWTs and expose authenticated user context to protected routes
- Handle Razorpay webhooks centrally and route events to the correct app handler
- Ensure all inputs and outputs are validated with Zod schemas
- Support multiple client apps through `notes.app` metadata routing
- Never expose Razorpay credentials or secrets to any client
- Be fully type-safe end-to-end using TypeScript
- **Persist all orders, verified payments, and webhook events to PostgreSQL via Prisma**
- **Provide DB-backed idempotency for webhook processing (survives restarts and deploys)**
- **Expose payment history query endpoints for authenticated app use**

### Non-Goals (v1.1)

- No admin dashboard UI (planned for v2)
- No subscription billing management (planned for v2)
- No multi-currency support (v1 supports INR only)
- No multi-Razorpay account support (single key pair in v1)
- No real-time event streaming (planned for v2 with queues)

---

## 4. Tech Stack & Justification

| Technology        | Role            | Why                                                                     |
| ----------------- | --------------- | ----------------------------------------------------------------------- |
| **Hono**          | HTTP Framework  | Lightweight, edge-compatible, fast routing, built-in middleware support |
| **TypeScript**    | Language        | Type safety, better DX, reduces runtime errors                          |
| **Zod**           | Validation      | Runtime schema validation + TypeScript type inference from schemas      |
| **Axios**         | HTTP Client     | Interceptor support for auth headers, retries, logging                  |
| **Razorpay**      | Payment Gateway | Order creation, payment verification, webhook events                    |
| **Clerk**         | Auth Platform   | JWT-based user identity, multi-app support                              |
| **Prisma**        | ORM             | Type-safe generated DB client, schema-driven migrations, excellent DX   |
| **PostgreSQL**    | Database        | ACID-compliant, reliable, native JSON support for webhook payloads      |
| **Node.js / Bun** | Runtime         | Server-side JavaScript; Bun preferred for speed                         |

---

## 5. System Architecture

### High-Level Architecture

```
+----------------------------------------------------------+
|                    Client Applications                    |
|          Web App 1  .  Web App 2  .  Mobile App           |
+---------------------+------------------------------------+
                       | HTTPS Requests + Clerk JWT
                       v
+----------------------------------------------------------+
|              Hono Central Service                         |
|  +------------------------------------------------------+ |
|  |                  Middleware Layer                     | |
|  |  CORS . Logger . Rate Limiter . Auth (Clerk JWT)     | |
|  +------------------+-----------------------------------+ |
|                     |                                     |
|  +------------------v-----------------------------------+ |
|  |                  Features Layer                       | |
|  |   +---------+   +----------+   +----------------+   | |
|  |   |  Auth   |   | Payments |   |    Webhooks    |   | |
|  |   | Feature |   | Feature  |   |    Feature     |   | |
|  |   +---------+   +----+-----+   +-------+--------+   | |
|  +------------------+---+--------------------+---------+ |
|                     |                        |            |
|  +------------------v------------------------v---------+ |
|  |              Domain / Service Layer                   | |
|  |   Business Logic . Signature Verification .          | |
|  |   Event Routing . User Association                   | |
|  +------------------+-----------------------------------+ |
|                     |                                     |
|  +------------------v-----------------------------------+ |
|  |            Infrastructure / Adapter Layer             | |
|  |   Axios Client . Razorpay API . Clerk SDK            | |
|  |   Prisma Client . Repository Layer                   | |
|  +----------+----------------------------------+--------+ |
+-------------+----------------------------------+---------+
              |                                  |
   +----------v--------+            +------------v----------+
   | Razorpay API      |            |   PostgreSQL DB        |
   | Clerk Auth API    |            |   (via Prisma ORM)     |
   +-------------------+            |                        |
                                    |  orders                |
                                    |  payments              |
                                    |  webhook_events        |
                                    +------------------------+
```

### Request Lifecycle

```
Request In
    |
    v
CORS Middleware
    |
    v
Logger Middleware (log method, path, ip)
    |
    v
Rate Limiter Middleware
    |
    v
Body Parser / JSON Middleware
    |
    v
Route Match
    |
    +-- Public Route --> Feature Handler directly
    |
    +-- Protected Route
             |
             v
        Auth Middleware (Clerk JWT verification)
             |
             +-- Invalid Token --> 401 Unauthorized
             |
             +-- Valid Token
                      |
                      v
                 c.set("user", clerkUser)
                      |
                      v
                 Feature Handler
                      |
                      v
                 Zod Validation
                      |
                      v
                 Service / Domain Logic
                      |
                      v
               Prisma Repository (DB read/write)
                      |
                      v
                 Response Out
```

---

## 6. Folder Structure

### Complete Feature-First + Clean Architecture (with Prisma)

```
.
+-- prisma/
|   +-- schema.prisma               # Full DB schema definition
|   +-- migrations/                 # Auto-generated migration files
|   |   +-- 20250101_init/
|   |       +-- migration.sql
|   +-- seed.ts                     # Development seed data
|
src/
|
+-- app/
|   +-- index.ts                    # Hono app initialization + middleware
|   +-- routes.ts                   # Central route registration
|   +-- server.ts                   # Server entry point (listen/export)
|
+-- features/
|   |
|   +-- auth/
|   |   +-- api/
|   |   |   +-- auth.routes.ts      # /auth/* route handlers
|   |   +-- middleware/
|   |   |   +-- clerk.middleware.ts # Clerk JWT middleware
|   |   +-- services/
|   |   |   +-- clerk.service.ts    # verifyClerkToken(), getUser()
|   |   +-- validators/
|   |   |   +-- auth.schema.ts
|   |   +-- types/
|   |   |   +-- auth.types.ts       # ClerkUser, AuthContext types
|   |   +-- index.ts
|   |
|   +-- payments/
|   |   +-- api/
|   |   |   +-- payments.routes.ts  # /payments/* route handlers
|   |   +-- services/
|   |   |   +-- order.service.ts    # createOrder() -- Razorpay + DB write
|   |   |   +-- verify.service.ts   # verifyPayment() -- verify + DB write
|   |   +-- repositories/
|   |   |   +-- order.repository.ts     # Prisma CRUD for orders table
|   |   |   +-- payment.repository.ts   # Prisma CRUD for payments table
|   |   +-- validators/
|   |   |   +-- createOrder.schema.ts
|   |   |   +-- verifyPayment.schema.ts
|   |   +-- types/
|   |   |   +-- payments.types.ts
|   |   +-- utils/
|   |   |   +-- signature.util.ts
|   |   +-- index.ts
|   |
|   +-- webhook/
|       +-- api/
|       |   +-- webhook.routes.ts   # /webhook/* route handlers
|       +-- services/
|       |   +-- webhook.service.ts  # processWebhookEvent() with DB idempotency
|       |   +-- router.service.ts   # routeEventByApp()
|       +-- repositories/
|       |   +-- webhookEvent.repository.ts  # Prisma CRUD for webhook_events
|       +-- validators/
|       |   +-- webhook.schema.ts
|       +-- types/
|       |   +-- webhook.types.ts
|       +-- handlers/
|       |   +-- app1.handler.ts
|       |   +-- app2.handler.ts
|       +-- index.ts
|
+-- shared/
|   +-- api/
|   |   +-- axios.ts                # Axios client (Razorpay base config)
|   +-- config/
|   |   +-- env.ts                  # Typed + Zod-validated env vars
|   +-- db/
|   |   +-- prisma.ts               # Prisma client singleton
|   +-- constants/
|   |   +-- app.constants.ts        # App name enums
|   |   +-- razorpay.constants.ts   # Event names, API URLs
|   +-- middleware/
|   |   +-- cors.middleware.ts
|   |   +-- logger.middleware.ts
|   |   +-- rateLimit.middleware.ts
|   |   +-- error.middleware.ts     # Handles Prisma errors too
|   +-- types/
|   |   +-- hono.types.ts           # Extended Hono context bindings
|   |   +-- api.types.ts            # Generic ApiResponse<T> type
|   +-- utils/
|   |   +-- response.util.ts
|   |   +-- crypto.util.ts
|   +-- validators/
|       +-- common.schema.ts        # Shared Zod schemas
|
+-- index.ts                        # Root entry point
```

---

## 7. Environment Configuration

### `shared/config/env.ts`

```typescript
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SERVICE_BASE_URL: z.string().url(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  DIRECT_URL: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  RAZORPAY_BASE_URL: z.string().url().default("https://api.razorpay.com/v1"),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_JWT_ISSUER: z.string().url(),

  ALLOWED_ORIGINS: z.string().transform((s) => s.split(",")),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;
```

---

## 8. Middleware Layer

### 8.1 CORS Middleware

**File:** `shared/middleware/cors.middleware.ts`

```typescript
import { cors } from "hono/cors";
import { env } from "../config/env";

export const corsMiddleware = cors({
  origin: env.ALLOWED_ORIGINS,
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
  credentials: true,
});
```

---

### 8.2 Logger Middleware

**File:** `shared/middleware/logger.middleware.ts`

```typescript
import { createMiddleware } from "hono/factory";
import { env } from "../config/env";

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const ip = c.req.header("x-forwarded-for") ?? "unknown";

  await next();

  const log = {
    method,
    path,
    status: c.res.status,
    ms: Date.now() - start,
    ip,
    timestamp: new Date().toISOString(),
  };

  if (env.LOG_FORMAT === "json") {
    console.log(JSON.stringify(log));
  } else {
    console.log(
      `[${log.timestamp}] ${method} ${path} -> ${log.status} (${log.ms}ms)`,
    );
  }
});
```

---

### 8.3 Rate Limiter Middleware

**File:** `shared/middleware/rateLimit.middleware.ts`

> Note: v1.1 uses in-memory storage. Migrate to Redis (Section 22) for distributed deployments.

```typescript
import { createMiddleware } from "hono/factory";
import { env } from "../config/env";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip = c.req.header("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, {
      count: 1,
      resetAt: now + env.RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }

  if (entry.count >= env.RATE_LIMIT_MAX_REQUESTS) {
    return c.json(
      { success: false, error: "Too many requests. Please slow down." },
      429,
    );
  }

  entry.count++;
  return next();
});
```

---

### 8.4 Auth Middleware (Clerk JWT)

**File:** `features/auth/middleware/clerk.middleware.ts`

```typescript
import { createMiddleware } from "hono/factory";
import { clerkService } from "../services/clerk.service";

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { success: false, error: "Missing or malformed Authorization header." },
      401,
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const result = await clerkService.verifyToken(token);

  if (!result.success) {
    return c.json({ success: false, error: "Invalid or expired token." }, 401);
  }

  c.set("user", result.user);
  return next();
});
```

Applied to: `/payments/create-order`, `/payments/verify`, `/payments/orders`
Not applied to: `/webhook/razorpay` (uses Razorpay signature instead)

---

### 8.5 Error Handler Middleware (Prisma-aware)

**File:** `shared/middleware/error.middleware.ts`

```typescript
import { Hono } from "hono";
import { Prisma } from "@prisma/client";

export function registerErrorHandlers(app: Hono) {
  app.notFound((c) =>
    c.json({ success: false, error: "Route not found." }, 404),
  );

  app.onError((err, c) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return c.json(
          {
            success: false,
            error: "Duplicate record — this entry already exists.",
          },
          409,
        );
      }
      if (err.code === "P2025") {
        return c.json({ success: false, error: "Record not found." }, 404);
      }
    }

    if (err instanceof Prisma.PrismaClientInitializationError) {
      console.error("Database connection failed:", err.message);
      return c.json(
        {
          success: false,
          error: "Database unavailable. Please try again later.",
        },
        503,
      );
    }

    console.error("Unhandled error:", err);
    return c.json({ success: false, error: "Internal server error." }, 500);
  });
}
```

---

### 8.6 Middleware Registration Order

**File:** `app/index.ts`

```typescript
import { Hono } from "hono";
import { corsMiddleware } from "../shared/middleware/cors.middleware";
import { loggerMiddleware } from "../shared/middleware/logger.middleware";
import { rateLimitMiddleware } from "../shared/middleware/rateLimit.middleware";
import { registerErrorHandlers } from "../shared/middleware/error.middleware";
import { registerRoutes } from "./routes";

const app = new Hono();

app.use("*", corsMiddleware); // 1. CORS headers
app.use("*", loggerMiddleware); // 2. Log every request
app.use("*", rateLimitMiddleware); // 3. Rate limit

registerRoutes(app);
registerErrorHandlers(app);

export default app;
```

---

## 9. Feature: Auth

### 9.1 Purpose

Validates Clerk JWT tokens and exposes authenticated user context (`userId`, `sessionId`, `email`) to all protected routes. The Auth feature has **no DB writes** — it is a stateless validation layer only.

### 9.2 Clerk Service

**File:** `features/auth/services/clerk.service.ts`

```typescript
import Clerk from "@clerk/clerk-sdk-node";
import { env } from "../../../shared/config/env";
import { ClerkUserPayload } from "../types/auth.types";

const clerk = Clerk({ secretKey: env.CLERK_SECRET_KEY });

export const clerkService = {
  async verifyToken(
    token: string,
  ): Promise<
    | { success: true; user: ClerkUserPayload }
    | { success: false; error: string }
  > {
    try {
      const payload = await clerk.verifyToken(token, {
        issuer: env.CLERK_JWT_ISSUER,
      });
      return {
        success: true,
        user: {
          userId: payload.sub,
          sessionId: payload.sid,
          email: payload.email ?? null,
        },
      };
    } catch {
      return { success: false, error: "Token verification failed." };
    }
  },

  async getUser(userId: string) {
    return clerk.users.getUser(userId);
  },
};
```

### 9.3 Types

**File:** `features/auth/types/auth.types.ts`

```typescript
export interface ClerkUserPayload {
  userId: string;
  sessionId: string;
  email: string | null;
}

export type HonoVariables = {
  user: ClerkUserPayload;
};
```

### 9.4 Auth Route

**File:** `features/auth/api/auth.routes.ts`

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../middleware/clerk.middleware";

const authRoutes = new Hono();

authRoutes.get("/me", authMiddleware, (c) => {
  const user = c.get("user");
  return c.json({ success: true, data: user });
});

export default authRoutes;
```

---

## 10. Feature: Payments

### 10.1 Purpose

Manages the full payment lifecycle:

1. Create a Razorpay order, persist it to the `orders` table, return `orderId` to client
2. Verify payment signature after checkout, persist to `payments` table, update order status
3. Query paginated order + payment history for authenticated users

### 10.2 Route Registration

**File:** `features/payments/api/payments.routes.ts`

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../../auth/middleware/clerk.middleware";
import { zValidator } from "@hono/zod-validator";
import { createOrderSchema } from "../validators/createOrder.schema";
import { verifyPaymentSchema } from "../validators/verifyPayment.schema";
import { orderService } from "../services/order.service";
import { verifyService } from "../services/verify.service";
import { orderRepository } from "../repositories/order.repository";

const paymentRoutes = new Hono();

// POST /payments/create-order
paymentRoutes.post(
  "/create-order",
  authMiddleware,
  zValidator("json", createOrderSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");

    const result = await orderService.createOrder({
      ...body,
      userId: user.userId,
    });
    if (!result.success)
      return c.json({ success: false, error: result.error }, 400);
    return c.json({ success: true, data: result.data }, 201);
  },
);

// POST /payments/verify
paymentRoutes.post(
  "/verify",
  authMiddleware,
  zValidator("json", verifyPaymentSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await verifyService.verifyPayment(body);
    if (!result.success)
      return c.json({ success: false, error: result.error }, 400);
    return c.json({ success: true, data: result.data }, 200);
  },
);

// GET /payments/orders
paymentRoutes.get("/orders", authMiddleware, async (c) => {
  const user = c.get("user");
  const app = c.req.query("app");
  const status = c.req.query("status");
  const limit = Number(c.req.query("limit") ?? 20);
  const offset = Number(c.req.query("offset") ?? 0);

  const orders = await orderRepository.findByUser({
    userId: user.userId,
    app,
    status,
    limit,
    offset,
  });
  return c.json({ success: true, data: orders });
});

export default paymentRoutes;
```

### 10.3 Validators

**File:** `features/payments/validators/createOrder.schema.ts`

```typescript
import { z } from "zod";

export const createOrderSchema = z.object({
  amount: z
    .number({ required_error: "Amount is required." })
    .min(100, "Minimum amount is Rs 1 (100 paise).")
    .int("Amount must be an integer in paise."),
  currency: z.string().default("INR"),
  app: z.enum(["web-app-1", "web-app-2", "mobile-app"], {
    errorMap: () => ({ message: "Invalid app identifier." }),
  }),
  productId: z.string().min(1, "Product ID is required."),
  receipt: z.string().max(40).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
```

**File:** `features/payments/validators/verifyPayment.schema.ts`

```typescript
import { z } from "zod";

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required."),
  paymentId: z.string().min(1, "Payment ID is required."),
  signature: z.string().min(1, "Signature is required."),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
```

### 10.4 Order Service (with DB persistence)

**File:** `features/payments/services/order.service.ts`

```typescript
import { axiosClient } from "../../../shared/api/axios";
import { orderRepository } from "../repositories/order.repository";
import { CreateOrderInput } from "../validators/createOrder.schema";
import { RazorpayOrder } from "../types/payments.types";

export const orderService = {
  async createOrder(input: CreateOrderInput & { userId: string }) {
    try {
      // Step 1: Create order in Razorpay
      const { data } = await axiosClient.post<RazorpayOrder>("/orders", {
        amount: input.amount,
        currency: input.currency ?? "INR",
        receipt: input.receipt ?? `rcpt_${Date.now()}`,
        notes: {
          app: input.app,
          userId: input.userId,
          productId: input.productId,
        },
      });

      // Step 2: Persist order to DB
      await orderRepository.create({
        razorpayOrderId: data.id,
        amount: data.amount,
        currency: data.currency,
        receipt: data.receipt,
        status: "CREATED",
        app: input.app,
        userId: input.userId,
        productId: input.productId,
      });

      return {
        success: true as const,
        data: {
          orderId: data.id,
          amount: data.amount,
          currency: data.currency,
          receipt: data.receipt,
        },
      };
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.description ?? "Failed to create order.";
      return { success: false as const, error: message };
    }
  },
};
```

### 10.5 Verify Service (with DB persistence)

**File:** `features/payments/services/verify.service.ts`

```typescript
import { createHmac } from "crypto";
import { env } from "../../../shared/config/env";
import { orderRepository } from "../repositories/order.repository";
import { paymentRepository } from "../repositories/payment.repository";
import { VerifyPaymentInput } from "../validators/verifyPayment.schema";

export const verifyService = {
  async verifyPayment(input: VerifyPaymentInput) {
    const { orderId, paymentId, signature } = input;

    // Step 1: Verify HMAC signature
    const expectedSignature = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expectedSignature !== signature) {
      return {
        success: false as const,
        error: "Payment signature verification failed.",
      };
    }

    // Step 2: Confirm order exists in DB
    const order = await orderRepository.findByRazorpayId(orderId);
    if (!order) {
      return { success: false as const, error: "Order not found." };
    }

    // Step 3: Persist verified payment
    const payment = await paymentRepository.create({
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
      orderId: order.id,
      signature,
      status: "VERIFIED",
      verifiedAt: new Date(),
    });

    // Step 4: Update order status to PAID
    await orderRepository.updateStatus(order.id, "PAID");

    return {
      success: true as const,
      data: {
        orderId,
        paymentId,
        verified: true,
        verifiedAt: payment.verifiedAt!.toISOString(),
      },
    };
  },
};
```

### 10.6 Repositories

**File:** `features/payments/repositories/order.repository.ts`

```typescript
import { prisma } from "@db/prisma";
import { OrderStatus } from "@prisma/client";

export const orderRepository = {
  async create(data: {
    razorpayOrderId: string;
    amount: number;
    currency: string;
    receipt: string;
    status: OrderStatus;
    app: string;
    userId: string;
    productId: string;
  }) {
    return prisma.order.create({ data });
  },

  async findByRazorpayId(razorpayOrderId: string) {
    return prisma.order.findUnique({ where: { razorpayOrderId } });
  },

  async updateStatus(id: string, status: OrderStatus) {
    return prisma.order.update({ where: { id }, data: { status } });
  },

  async findByUser(params: {
    userId: string;
    app?: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    return prisma.order.findMany({
      where: {
        userId: params.userId,
        ...(params.app ? { app: params.app } : {}),
        ...(params.status ? { status: params.status as OrderStatus } : {}),
      },
      include: { payment: true },
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.offset,
    });
  },
};
```

**File:** `features/payments/repositories/payment.repository.ts`

```typescript
import { prisma } from "@db/prisma";
import { PaymentStatus } from "@prisma/client";

export const paymentRepository = {
  async create(data: {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    orderId: string;
    signature: string;
    status: PaymentStatus;
    verifiedAt: Date;
  }) {
    return prisma.payment.create({ data });
  },

  async findByRazorpayPaymentId(razorpayPaymentId: string) {
    return prisma.payment.findUnique({ where: { razorpayPaymentId } });
  },

  async findByOrderId(orderId: string) {
    return prisma.payment.findUnique({ where: { orderId } });
  },
};
```

### 10.7 Payment Types

**File:** `features/payments/types/payments.types.ts`

```typescript
export interface RazorpayOrder {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  notes: Record<string, string>;
  created_at: number;
}

export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface VerifyPaymentResponse {
  orderId: string;
  paymentId: string;
  verified: boolean;
  verifiedAt: string;
}
```

---

## 11. Feature: Webhooks

### 11.1 Purpose

Receives, verifies, and routes all Razorpay webhook events. Uses **DB-backed idempotency** via the `webhook_events` table so duplicate events are safely rejected even across restarts and deployments.

### 11.2 Webhook Route

**File:** `features/webhook/api/webhook.routes.ts`

```typescript
import { Hono } from "hono";
import { webhookService } from "../services/webhook.service";

const webhookRoutes = new Hono();

// POST /webhook/razorpay
// No authMiddleware — Razorpay signs requests with HMAC instead
webhookRoutes.post("/razorpay", async (c) => {
  const rawBody = await c.req.text(); // Must be raw string BEFORE any JSON parsing
  const signature = c.req.header("x-razorpay-signature");

  if (!signature) {
    return c.json({ success: false, error: "Missing webhook signature." }, 400);
  }

  const result = await webhookService.process({ rawBody, signature });

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 400);
  }

  return c.json({ success: true }, 200);
});

export default webhookRoutes;
```

Critical: Razorpay retries if it receives a non-2xx response. Always return 200 for valid signed events regardless of processing outcome.

### 11.3 Webhook Service (DB-backed idempotency)

**File:** `features/webhook/services/webhook.service.ts`

```typescript
import { createHmac } from "crypto";
import { env } from "../../../shared/config/env";
import { routerService } from "./router.service";
import { webhookEventRepository } from "../repositories/webhookEvent.repository";
import { WebhookEvent } from "../types/webhook.types";

export const webhookService = {
  async process({
    rawBody,
    signature,
  }: {
    rawBody: string;
    signature: string;
  }) {
    // Step 1: Verify signature BEFORE touching DB
    if (!this.verifySignature(rawBody, signature)) {
      console.warn("[Webhook] Signature mismatch — possible spoofed request.");
      return { success: false as const, error: "Invalid webhook signature." };
    }

    // Step 2: Parse payload
    let event: WebhookEvent;
    try {
      event = JSON.parse(rawBody) as WebhookEvent;
    } catch {
      return { success: false as const, error: "Malformed JSON payload." };
    }

    const razorpayEventId =
      event.payload.payment?.entity?.id ?? `${event.event}_${event.created_at}`;
    const eventType = event.event;
    const app = event.payload.payment?.entity?.notes?.app ?? "unknown";

    // Step 3: DB-backed idempotency check
    const existing = await webhookEventRepository.findByRazorpayEventId(
      razorpayEventId,
      eventType,
    );
    if (existing) {
      console.info(
        `[Webhook] Duplicate skipped: ${eventType} / ${razorpayEventId}`,
      );
      return { success: true as const };
    }

    // Step 4: Persist as RECEIVED before processing
    const webhookRecord = await webhookEventRepository.create({
      razorpayEventId,
      eventType,
      app,
      rawPayload: rawBody,
      status: "RECEIVED",
    });

    // Step 5: Route and process
    try {
      await routerService.route(event);
      await webhookEventRepository.updateStatus(webhookRecord.id, "PROCESSED");
    } catch (err) {
      console.error("[Webhook] Processing error:", err);
      await webhookEventRepository.updateStatus(webhookRecord.id, "FAILED");
      // Do NOT rethrow — avoids 500 -> Razorpay retry loop
    }

    return { success: true as const };
  },

  verifySignature(rawBody: string, signature: string): boolean {
    const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    return expected === signature;
  },
};
```

### 11.4 Router Service

**File:** `features/webhook/services/router.service.ts`

```typescript
import { WebhookEvent } from "../types/webhook.types";
import { orderRepository } from "../../payments/repositories/order.repository";
import { app1Handler } from "../handlers/app1.handler";
import { app2Handler } from "../handlers/app2.handler";

export const routerService = {
  async route(event: WebhookEvent) {
    const payment = event.payload.payment?.entity;
    const app = payment?.notes?.app;
    const eventType = event.event;

    // Sync order status in DB on key payment events
    if (payment?.order_id) {
      if (eventType === "payment.captured") {
        const order = await orderRepository.findByRazorpayId(payment.order_id);
        if (order) await orderRepository.updateStatus(order.id, "PAID");
      }
      if (eventType === "payment.failed") {
        const order = await orderRepository.findByRazorpayId(payment.order_id);
        if (order) await orderRepository.updateStatus(order.id, "FAILED");
      }
    }

    // Dispatch to per-app handler
    switch (app) {
      case "web-app-1":
        return app1Handler.handle(eventType, event);
      case "web-app-2":
        return app2Handler.handle(eventType, event);
      case "mobile-app":
        break;
      default:
        console.warn(`[Router] Unknown app in notes: "${app}"`);
    }
  },
};
```

### 11.5 Webhook Event Repository

**File:** `features/webhook/repositories/webhookEvent.repository.ts`

```typescript
import { prisma } from "@db/prisma";
import { WebhookEventStatus } from "@prisma/client";

export const webhookEventRepository = {
  async create(data: {
    razorpayEventId: string;
    eventType: string;
    app: string;
    rawPayload: string;
    status: WebhookEventStatus;
  }) {
    return prisma.webhookEvent.create({ data });
  },

  async findByRazorpayEventId(razorpayEventId: string, eventType: string) {
    return prisma.webhookEvent.findFirst({
      where: {
        razorpayEventId,
        eventType,
        status: { not: "FAILED" }, // FAILED events are retryable
      },
    });
  },

  async updateStatus(id: string, status: WebhookEventStatus) {
    return prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        processedAt: status === "PROCESSED" ? new Date() : undefined,
      },
    });
  },

  async findFailed(limit = 50) {
    return prisma.webhookEvent.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  },
};
```

### 11.6 App Handlers

**File:** `features/webhook/handlers/app1.handler.ts`

```typescript
import { WebhookEvent } from "../types/webhook.types";

export const app1Handler = {
  async handle(eventType: string, event: WebhookEvent) {
    const payment = event.payload.payment?.entity;

    switch (eventType) {
      case "payment.captured":
        console.info(`[App1] Payment captured: ${payment?.id}`);
        // Notify App1 backend to activate subscription or credits
        // await axios.post("https://app1-backend.com/internal/activate", { paymentId: payment?.id });
        break;
      case "payment.failed":
        console.warn(`[App1] Payment failed: ${payment?.id}`);
        break;
      case "refund.processed":
        console.info(`[App1] Refund processed: ${payment?.id}`);
        break;
      default:
        console.info(`[App1] Unhandled event: ${eventType}`);
    }
  },
};
```

### 11.7 Supported Webhook Events

| Event                    | Description                   | DB Action                | Status  |
| ------------------------ | ----------------------------- | ------------------------ | ------- |
| `payment.captured`       | Payment successfully captured | `orders.status = PAID`   | Handled |
| `payment.failed`         | Payment failed                | `orders.status = FAILED` | Handled |
| `payment.authorized`     | Authorized but not captured   | Log only                 | Handled |
| `refund.processed`       | Refund has been processed     | Log only                 | Handled |
| `refund.failed`          | Refund failed                 | Log only                 | Handled |
| `order.paid`             | Order fully paid              | Confirm PAID status      | Handled |
| `subscription.activated` | Subscription went live        | —                        | v2      |
| `subscription.cancelled` | Subscription cancelled        | —                        | v2      |

---

## 12. Shared Infrastructure

### 12.1 Axios Client

**File:** `shared/api/axios.ts`

```typescript
import axios, { AxiosInstance, AxiosError } from "axios";
import { env } from "../config/env";

export const axiosClient: AxiosInstance = axios.create({
  baseURL: env.RAZORPAY_BASE_URL,
  auth: {
    username: env.RAZORPAY_KEY_ID,
    password: env.RAZORPAY_KEY_SECRET,
  },
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

axiosClient.interceptors.request.use((config) => {
  console.debug(`[Axios] -> ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const message =
      (error.response?.data as any)?.error?.description ?? error.message;
    console.error(`[Axios] Error ${status}: ${message}`);
    return Promise.reject(error);
  },
);
```

### 12.2 Response Utility

**File:** `shared/utils/response.util.ts`

```typescript
export const ApiResponse = {
  success<T>(data: T, message?: string) {
    return { success: true, data, message: message ?? "OK" };
  },
  error(error: string, code?: number) {
    return { success: false, error, code };
  },
};
```

### 12.3 Route Registration

**File:** `app/routes.ts`

```typescript
import { Hono } from "hono";
import authRoutes from "../features/auth/api/auth.routes";
import paymentRoutes from "../features/payments/api/payments.routes";
import webhookRoutes from "../features/webhook/api/webhook.routes";

export function registerRoutes(app: Hono) {
  app.route("/auth", authRoutes);
  app.route("/payments", paymentRoutes);
  app.route("/webhook", webhookRoutes);
  app.get("/health", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() }),
  );
}
```

---

## 13. Database Layer

### 13.1 Overview

This service owns its database entirely. No external app writes to it directly — all data access goes through this service's API or webhook routing layer.

| Table            | Feature  | Purpose                                                |
| ---------------- | -------- | ------------------------------------------------------ |
| `orders`         | Payments | Every Razorpay order created — full lifecycle tracking |
| `payments`       | Payments | Verified payments with signature proof                 |
| `webhook_events` | Webhooks | Immutable event log and DB-backed idempotency store    |

### 13.2 Prisma Client Singleton

**File:** `shared/db/prisma.ts`

```typescript
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

// Prevent multiple instances during hot reload in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### 13.3 Prisma Schema

**File:** `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")    // Optional: required for Prisma Migrate with poolers
}

// ── Enums ────────────────────────────────────────────────────

enum OrderStatus {
  CREATED     // Order created in Razorpay, awaiting payment
  ATTEMPTED   // Payment attempted but not confirmed
  PAID        // Payment captured and verified
  FAILED      // Payment failed
  REFUNDED    // Order has been refunded
}

enum PaymentStatus {
  VERIFIED    // Signature verified server-side
  REFUNDED    // Payment refunded
}

enum WebhookEventStatus {
  RECEIVED    // Event received and stored, not yet processed
  PROCESSED   // Successfully processed
  FAILED      // Processing error — eligible for retry
}

// ── Models ───────────────────────────────────────────────────

model Order {
  id               String      @id @default(cuid())
  razorpayOrderId  String      @unique
  amount           Int                              // Always in paise (Rs 1 = 100 paise)
  currency         String      @default("INR")
  receipt          String
  status           OrderStatus @default(CREATED)
  app              String                           // e.g. "web-app-1"
  userId           String                           // Clerk userId
  productId        String                           // App-defined product reference
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  payment          Payment?                         // One-to-one relation

  @@index([userId])
  @@index([app])
  @@index([userId, app])
  @@index([status])
  @@index([createdAt])
  @@map("orders")
}

model Payment {
  id                 String        @id @default(cuid())
  razorpayPaymentId  String        @unique
  razorpayOrderId    String                          // Denormalized for direct lookups
  orderId            String        @unique           // FK -> Order
  signature          String                          // HMAC-SHA256 proof of verification
  status             PaymentStatus @default(VERIFIED)
  verifiedAt         DateTime?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  order              Order         @relation(fields: [orderId], references: [id])

  @@index([razorpayOrderId])
  @@map("payments")
}

model WebhookEvent {
  id               String             @id @default(cuid())
  razorpayEventId  String
  eventType        String                              // e.g. "payment.captured"
  app              String                              // Extracted from notes.app
  rawPayload       String             @db.Text         // Full raw JSON for replay/debugging
  status           WebhookEventStatus @default(RECEIVED)
  processedAt      DateTime?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  @@unique([razorpayEventId, eventType])              // Composite unique for DB-level idempotency
  @@index([app])
  @@index([status])
  @@index([eventType])
  @@index([createdAt])
  @@map("webhook_events")
}
```

### 13.4 Schema Design Decisions

| Decision                                 | Reason                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `amount` as `Int` (paise)                | Matches Razorpay exactly; avoids floating-point precision bugs                 |
| `rawPayload` as `Text`                   | Full event replay without hitting Razorpay API again                           |
| `@@unique([razorpayEventId, eventType])` | Composite DB-level guard against concurrent duplicate inserts                  |
| `signature` stored on Payment            | Cryptographic audit proof that server-side verification occurred               |
| `Payment.razorpayOrderId` denormalized   | Direct lookups by Razorpay IDs without extra JOINs                             |
| `DIRECT_URL` in datasource               | Required for PgBouncer/Supabase pooling; Prisma Migrate uses direct connection |
| `FAILED` events retryable                | Idempotency check skips FAILED records intentionally so they can be replayed   |

### 13.5 Migration Strategy

#### Initial Setup

```bash
# Install Prisma
npm install prisma @prisma/client

# Initialize (creates prisma/schema.prisma and .env)
npx prisma init

# Create and apply first migration
npx prisma migrate dev --name init

# Generate Prisma Client types
npx prisma generate
```

#### Adding New Migrations

```bash
# After editing schema.prisma
npx prisma migrate dev --name add_refunds_table

# Check migration status
npx prisma migrate status
```

#### Production Deployment

```bash
# Safe, non-interactive production command
npx prisma migrate deploy

# Never use `migrate dev` in production — it prompts and may reset data
```

#### Rollback Strategy

Prisma does not provide automatic rollbacks. Options:

```bash
# Option 1: Write and apply a manual SQL rollback
npx prisma db execute --file ./prisma/rollback.sql --schema ./prisma/schema.prisma

# Option 2: Restore from a database snapshot (preferred for critical failures)
```

### 13.6 Seed File (Development)

**File:** `prisma/seed.ts`

```typescript
import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  WebhookEventStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding development database...");

  const order = await prisma.order.create({
    data: {
      razorpayOrderId: "order_DEV_001",
      amount: 49900,
      currency: "INR",
      receipt: "rcpt_dev_001",
      status: OrderStatus.PAID,
      app: "web-app-1",
      userId: "user_dev_clerk_001",
      productId: "prod_premium_monthly",
    },
  });

  await prisma.payment.create({
    data: {
      razorpayPaymentId: "pay_DEV_001",
      razorpayOrderId: "order_DEV_001",
      orderId: order.id,
      signature: "dev_hmac_signature_hash",
      status: PaymentStatus.VERIFIED,
      verifiedAt: new Date(),
    },
  });

  await prisma.webhookEvent.create({
    data: {
      razorpayEventId: "pay_DEV_001",
      eventType: "payment.captured",
      app: "web-app-1",
      rawPayload: JSON.stringify({ event: "payment.captured", payload: {} }),
      status: WebhookEventStatus.PROCESSED,
      processedAt: new Date(),
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**`package.json` seed config:**

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

### 13.7 Connection Pooling (Production)

| Environment         | Setup                                                    |
| ------------------- | -------------------------------------------------------- |
| Railway / Render    | Direct PostgreSQL URL, no pooler needed                  |
| Vercel / Serverless | Prisma Accelerate or PgBouncer with `connection_limit=1` |
| Supabase            | Pooler URL as `DATABASE_URL`, direct as `DIRECT_URL`     |
| Self-hosted         | PgBouncer in transaction mode                            |

```env
# Supabase example
DATABASE_URL="postgresql://user:pass@db.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://user:pass@db.supabase.co:5432/postgres"
```

### 13.8 Useful Prisma Commands Reference

```bash
npx prisma studio              # Open visual DB browser at localhost:5555
npx prisma migrate dev         # Create + apply migration in dev
npx prisma migrate deploy      # Apply migrations in production
npx prisma migrate reset       # Reset DB + re-run all migrations (dev only)
npx prisma generate            # Regenerate client after schema changes
npx prisma db seed             # Run seed file
npx prisma migrate status      # Show pending/applied migrations
npx prisma db pull             # Introspect existing DB -> schema (reverse engineer)
```

---

## 14. API Contract

### Base URL

```
https://pay.yourapi.com
```

### Authentication

Protected routes require:

```
Authorization: Bearer <clerk_jwt_token>
```

---

### `GET /health`

**Access:** Public  
**Response `200`:**

```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

---

### `GET /auth/me`

**Access:** Protected  
**Response `200`:**

```json
{
  "success": true,
  "data": {
    "userId": "user_2xxxxxxxxxxx",
    "sessionId": "sess_2xxxxxxxxxxx",
    "email": "user@example.com"
  }
}
```

---

### `POST /payments/create-order`

**Access:** Protected  
**Request Body:**

```json
{
  "amount": 49900,
  "currency": "INR",
  "app": "web-app-1",
  "productId": "prod_premium_monthly",
  "receipt": "order_rcpt_001"
}
```

| Field       | Type     | Required | Notes                                   |
| ----------- | -------- | -------- | --------------------------------------- |
| `amount`    | `number` | Yes      | In paise. Rs 499 = 49900                |
| `currency`  | `string` | No       | Defaults to `"INR"`                     |
| `app`       | `string` | Yes      | Must match allowed enum values          |
| `productId` | `string` | Yes      | App-defined product reference           |
| `receipt`   | `string` | No       | Max 40 chars; auto-generated if omitted |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "orderId": "order_XXXXXXXXXXXXXX",
    "amount": 49900,
    "currency": "INR",
    "receipt": "order_rcpt_001"
  }
}
```

DB effect: New row inserted in `orders` with `status = CREATED`.

---

### `POST /payments/verify`

**Access:** Protected  
**Request Body:**

```json
{
  "orderId": "order_XXXXXXXXXXXXXX",
  "paymentId": "pay_XXXXXXXXXXXXXX",
  "signature": "hmac_sha256_hex_string"
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "orderId": "order_XXXXXXXXXXXXXX",
    "paymentId": "pay_XXXXXXXXXXXXXX",
    "verified": true,
    "verifiedAt": "2025-01-01T12:00:00.000Z"
  }
}
```

DB effect: New row in `payments`; `orders.status` updated to `PAID`.

---

### `GET /payments/orders`

**Access:** Protected  
**Query Parameters:**

| Param    | Type     | Required | Default | Description                        |
| -------- | -------- | -------- | ------- | ---------------------------------- |
| `app`    | `string` | No       | —       | Filter by app identifier           |
| `status` | `string` | No       | —       | Filter by `OrderStatus` enum value |
| `limit`  | `number` | No       | `20`    | Max results per page               |
| `offset` | `number` | No       | `0`     | Pagination offset                  |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "clxxxxx",
      "razorpayOrderId": "order_XXXXXXXXXXXXXX",
      "amount": 49900,
      "currency": "INR",
      "status": "PAID",
      "app": "web-app-1",
      "productId": "prod_premium_monthly",
      "createdAt": "2025-01-01T10:00:00.000Z",
      "payment": {
        "razorpayPaymentId": "pay_XXXXXXXXXXXXXX",
        "status": "VERIFIED",
        "verifiedAt": "2025-01-01T10:05:00.000Z"
      }
    }
  ]
}
```

---

### `POST /webhook/razorpay`

**Access:** Public (Razorpay HMAC-signed)  
**Required Headers:**

```
x-razorpay-signature: <hmac_sha256_hex>
Content-Type: application/json
```

**Response `200`:**

```json
{ "success": true }
```

DB effect: New row in `webhook_events`; status updated to `PROCESSED` or `FAILED`.

---

## 15. Data Flow Diagrams

### Payment Creation Flow

```
Client App
  |
  |  POST /payments/create-order { amount, app, productId }
  |  Authorization: Bearer <clerk_jwt>
  v
Hono Service
  |
  +-- Auth Middleware (verify Clerk JWT)
  |     +-- Invalid -> 401
  |     +-- Valid -> c.set("user", { userId })
  |
  +-- Zod Validation -> invalid body -> 400
  |
  +-- orderService.createOrder()
        |
        +-- POST https://api.razorpay.com/v1/orders
        |     { amount, currency, receipt, notes: { app, userId, productId } }
        |     +-- Error -> 400 { error }
        |     +-- Success -> { id, amount, ... }
        |
        +-- prisma.order.create()
              { razorpayOrderId, amount, status: CREATED, app, userId, productId }
              +-- Success -> 201 { orderId, amount, currency }
```

### Payment Verify Flow

```
Client App (after Razorpay Checkout)
  |
  |  POST /payments/verify { orderId, paymentId, signature }
  v
Hono Service
  |
  +-- Auth Middleware, Zod Validation
  |
  +-- verifyService.verifyPayment()
        |
        +-- HMAC_SHA256(key_secret, orderId|paymentId)
        |     +-- Mismatch -> 400 { error }
        |     +-- Match -> continue
        |
        +-- prisma.order.findUnique({ razorpayOrderId })
        |     +-- Not found -> 400 { error }
        |
        +-- prisma.payment.create()
        |     { razorpayPaymentId, orderId, signature, status: VERIFIED }
        |
        +-- prisma.order.update({ status: PAID })
              +-- 200 { verified: true, verifiedAt }
```

### Webhook Flow

```
Razorpay (payment event fires)
  |
  |  POST /webhook/razorpay
  |  Headers: x-razorpay-signature
  |  Body: raw JSON
  v
Hono Service
  |
  +-- Read raw body string (before JSON parse)
  +-- Verify x-razorpay-signature via HMAC
  |     +-- Invalid -> 400
  |
  +-- Parse JSON -> extract eventType, paymentId, notes.app
  |
  +-- prisma.webhookEvent.findFirst({ razorpayEventId, eventType, status != FAILED })
  |     +-- Found (duplicate) -> return 200 (skip)
  |
  +-- prisma.webhookEvent.create({ status: RECEIVED, rawPayload })
  |
  +-- routerService.route(event)
  |     +-- Update orders.status in DB (PAID or FAILED)
  |     +-- Dispatch to per-app handler
  |
  +-- prisma.webhookEvent.update({ status: PROCESSED })
  |
  +-- Return 200 OK

On handler error:
  +-- prisma.webhookEvent.update({ status: FAILED })
      (FAILED events can be replayed, not permanently blocked)
```

---

## 16. Error Handling Strategy

### Guiding Principles

1. Never expose internal DB error details to clients in production
2. Log everything — including swallowed errors
3. Fail fast on Zod validation — return `400` immediately
4. Webhook errors never return `5xx` — always `200` for valid signed events
5. Prisma errors are caught at the global error handler and translated to clean HTTP responses
6. Auth errors return `401`, not `403`

### HTTP Status Code Map

| Scenario                           | Status                      |
| ---------------------------------- | --------------------------- |
| Invalid Zod schema                 | `400 Bad Request`           |
| Missing Authorization header       | `401 Unauthorized`          |
| Invalid / expired Clerk JWT        | `401 Unauthorized`          |
| Invalid Razorpay payment signature | `400 Bad Request`           |
| Invalid webhook signature          | `400 Bad Request`           |
| Order not found in DB              | `400 Bad Request`           |
| Duplicate DB record (Prisma P2002) | `409 Conflict`              |
| DB record not found (Prisma P2025) | `404 Not Found`             |
| Route not found                    | `404 Not Found`             |
| Too many requests                  | `429 Too Many Requests`     |
| Razorpay API failure               | `502 Bad Gateway`           |
| DB connection failure              | `503 Service Unavailable`   |
| Unexpected server error            | `500 Internal Server Error` |

### Error Response Shape

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code?: number;
  issues?: ZodIssue[]; // Only on validation errors
}
```

---

## 17. Security Requirements

### 17.1 Secrets Management

- All secrets stored in environment variables only — never hardcoded
- `.env` in `.gitignore` — never committed to version control
- Use a secrets manager in production: Doppler, AWS Secrets Manager, or Infisical
- Rotate Razorpay API keys quarterly; rotate webhook secret immediately after any suspected exposure

### 17.2 Payment Verification

- All verification is server-side using HMAC-SHA256
- Clients never have access to `RAZORPAY_KEY_SECRET`
- Verified signatures are stored in the `payments` table as cryptographic audit proof

### 17.3 Webhook Security

- Always verify `x-razorpay-signature` before any DB read or write
- Use raw body string for HMAC — parsing JSON first corrupts verification
- `RAZORPAY_WEBHOOK_SECRET` is a separate secret from the API credentials
- DB unique constraint on `(razorpayEventId, eventType)` is a race-condition-safe safety net

### 17.4 Auth Security

- Clerk JWTs verified via Clerk SDK using Clerk's public key
- Tokens are short-lived — rotation is managed by Clerk
- No session state stored in this service — fully stateless per request
- Webhook endpoints deliberately excluded from auth middleware

### 17.5 Database Security

- DB credentials only in environment variables
- No external app writes directly to the DB — all access via this service's API
- Use a dedicated low-privilege DB user (not a superuser)
- Enable encryption at rest in production (supported by most managed Postgres providers)
- Automated daily backups with point-in-time recovery enabled
- `rawPayload` contains sensitive payment data — ensure DB access is logged

### 17.6 Transport Security

- All traffic over HTTPS only — HTTP rejected at the reverse proxy level
- Internal calls from webhook handlers to downstream app backends use service tokens

---

## 18. Validation Strategy

### Philosophy

Validate at the boundary. Every request body, every environment variable, every external API response that enters the service is validated with Zod before touching business logic or the database.

### Where Zod Is Used

| Location                                      | What Is Validated                                               |
| --------------------------------------------- | --------------------------------------------------------------- |
| `shared/config/env.ts`                        | All environment variables at startup — exits process if invalid |
| `payments/validators/createOrder.schema.ts`   | Request body for create-order                                   |
| `payments/validators/verifyPayment.schema.ts` | Request body for verify payment                                 |
| `webhook/validators/webhook.schema.ts`        | Incoming webhook payload structure                              |
| `auth/validators/auth.schema.ts`              | Token format before passing to Clerk SDK                        |

### Zod with `@hono/zod-validator`

```typescript
import { zValidator } from "@hono/zod-validator";

app.post(
  "/payments/create-order",
  zValidator("json", createOrderSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: "Validation failed.",
          issues: result.error.issues,
        },
        400,
      );
    }
  }),
  handler,
);
```

---

## 19. Logging & Observability

### Log Levels

| Level   | When to Use                                                          |
| ------- | -------------------------------------------------------------------- |
| `debug` | Axios requests, Prisma queries (dev only)                            |
| `info`  | Order created, payment verified, webhook processed                   |
| `warn`  | Duplicate webhook skipped, unknown app in routing                    |
| `error` | Signature mismatch, Razorpay failure, DB error, unhandled exceptions |

### What Gets Logged

| Event                     | Level   | Key Fields                      |
| ------------------------- | ------- | ------------------------------- |
| Incoming HTTP request     | `info`  | method, path, ip, status, ms    |
| Order created in DB       | `info`  | razorpayOrderId, app, userId    |
| Payment verified + stored | `info`  | orderId, paymentId              |
| Verification failed       | `warn`  | orderId                         |
| Webhook received          | `info`  | eventType, app, razorpayEventId |
| Webhook signature invalid | `error` | ip                              |
| Webhook duplicate skipped | `info`  | razorpayEventId, eventType      |
| Webhook processing error  | `error` | razorpayEventId, error message  |
| DB write success          | `debug` | table, record id                |
| DB connection error       | `error` | error message                   |
| Razorpay API error        | `error` | HTTP status, description        |

### Prisma Query Logging

Enabled automatically in development via the Prisma client singleton (`log: ["query", ...]`). Disabled in production to avoid logging sensitive query data.

### Recommended Tooling

- **Local:** Console JSON logs
- **Production:** Axiom / Logtail / Datadog
- **Alerts:** Spike in `error` log volume, `webhook_events.status = FAILED` count exceeds threshold, DB connection errors

---

## 20. Testing Strategy

### Testing Pyramid

```
         +--------------+
         |     E2E      |  (Hono test client + real test DB)
         +--------------+
         | Integration  |  (Mock Razorpay + Clerk; real Prisma + test DB)
         +--------------+
         |    Unit      |  (Services, validators, utils -- no DB)
         +--------------+
```

### Unit Tests (Required)

| File                      | What to Test                                    |
| ------------------------- | ----------------------------------------------- |
| `verify.service.ts`       | Valid and invalid HMAC signatures               |
| `webhook.service.ts`      | Signature verification logic only               |
| `createOrder.schema.ts`   | Amount edge cases, required fields, enum values |
| `verifyPayment.schema.ts` | Missing fields, type coercion                   |
| `env.ts`                  | Missing env vars cause process.exit             |
| `response.util.ts`        | Shape of success and error objects              |

### Integration Tests (Required)

| Scenario                       | DB                                     |           External |
| ------------------------------ | -------------------------------------- | -----------------: |
| Create order success           | Writes to `orders`                     |  Mock Razorpay 200 |
| Create order Razorpay failure  | No DB write                            |  Mock Razorpay 500 |
| Verify payment success         | Writes to `payments`, updates `orders` |                  — |
| Verify payment bad signature   | No DB writes                           |                  — |
| Verify payment order not in DB | No DB writes                           |                  — |
| Webhook valid + new event      | Creates `webhook_events` row           |                  — |
| Webhook valid + duplicate      | Skips — idempotency                    |                  — |
| Webhook invalid signature      | No DB writes                           |                  — |
| DB connection failure          | —                                      | Mock Prisma throws |

### Test Database Setup

```typescript
// Use a dedicated test database
// DATABASE_URL pointing to a separate test DB set in CI env

// Option: Wrap each test in a transaction that rolls back
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### E2E Test Scenarios

```
POST /payments/create-order -- valid JWT + body -> 201 + order row in DB
POST /payments/create-order -- expired JWT -> 401
POST /payments/create-order -- invalid body -> 400
POST /payments/create-order -- Razorpay error -> 400, no DB write

POST /payments/verify -- correct signature + existing order -> 200 + payment row in DB
POST /payments/verify -- wrong signature -> 400
POST /payments/verify -- order not in DB -> 400

GET /payments/orders -- valid JWT -> 200 with paginated list
GET /payments/orders -- ?app=web-app-1 -> filtered list
GET /payments/orders -- no JWT -> 401

POST /webhook/razorpay -- valid signature + new event -> 200 + PROCESSED in DB
POST /webhook/razorpay -- valid signature + duplicate -> 200 (idempotent)
POST /webhook/razorpay -- valid signature + handler error -> 200 + FAILED in DB
POST /webhook/razorpay -- invalid signature -> 400

GET /health -> 200
GET /unknown -> 404
```

---

## 21. Deployment & DevOps

### Recommended Stack

| Layer            | Tool                                                   |
| ---------------- | ------------------------------------------------------ |
| Runtime          | Node.js 20+ or Bun                                     |
| Database         | PostgreSQL 15+ (Supabase / Railway Postgres / AWS RDS) |
| Containerization | Docker                                                 |
| Hosting          | Railway / Render / Fly.io                              |
| Reverse Proxy    | Nginx / Cloudflare                                     |
| CI/CD            | GitHub Actions                                         |
| Secrets          | Doppler / AWS Secrets Manager                          |

### Dockerfile

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

# Generate Prisma Client for the target platform
RUN bunx prisma generate

RUN bun build ./src/index.ts --outdir ./dist --target bun

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma

EXPOSE 3000

# Run migrations then start server
CMD sh -c "bunx prisma migrate deploy && bun dist/index.js"
```

### `package.json` Scripts

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build ./src/index.ts --outdir ./dist --target bun",
    "start": "bun dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "db:generate": "prisma generate",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:studio": "prisma studio",
    "db:seed": "bun prisma/seed.ts",
    "db:reset": "prisma migrate reset"
  }
}
```

### GitHub Actions CI/CD Pipeline

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: payments_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://testuser:testpass@localhost:5432/payments_test
      RAZORPAY_KEY_ID: rzp_test_xxx
      RAZORPAY_KEY_SECRET: test_secret
      RAZORPAY_WEBHOOK_SECRET: test_webhook_secret
      CLERK_SECRET_KEY: sk_test_xxx
      CLERK_JWT_ISSUER: https://clerk.test.com
      SERVICE_BASE_URL: http://localhost:3000
      ALLOWED_ORIGINS: http://localhost:3000

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Generate Prisma Client
        run: bunx prisma generate

      - name: Run DB migrations
        run: bunx prisma migrate deploy

      - name: Type check
        run: bun run typecheck

      - name: Run tests
        run: bun test

      - name: Build
        run: bun run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### Health Check

```
GET /health -> 200 { "status": "ok", "timestamp": "..." }
```

Used by load balancers and uptime monitors.

---

## 22. Future Enhancements

### v1.2 — Operational Hardening

- [ ] Replace in-memory rate limiter with Redis (multi-instance safe)
- [ ] Add failed webhook replay endpoint: `POST /webhook/replay/:id`
- [ ] Retry logic with exponential backoff for Razorpay API calls
- [ ] Prisma Accelerate for edge caching and managed connection pooling

### v2.0 — Feature Expansion

- [ ] **Refund handling** — `POST /payments/refund` endpoint + `refunds` table in schema
- [ ] **Subscription support** — Razorpay Subscriptions API + `subscriptions` table
- [ ] **Queue system** — BullMQ / Kafka for async webhook processing at scale
- [ ] **Multi-account support** — Route different apps to different Razorpay credentials
- [ ] **Admin API** — Internal endpoints to query orders, payments, webhook event log

### v3.0 — Enterprise

- [ ] Multi-currency support
- [ ] PCI-DSS compliance review and audit
- [ ] SLA-based alerting on webhook failure rate and DB query latency
- [ ] Soft-delete and configurable data retention for `webhook_events`
- [ ] Audit log table for all service-level mutations

---

## 23. Success Criteria

| Criteria                                            | Measurement                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| All client apps route payments through this service | Zero direct Razorpay calls from clients                            |
| Zero duplicate payment logic across apps            | Code audit passes                                                  |
| All webhook events handled reliably                 | Less than 0.1% missed or dropped events                            |
| Payment signature always verified server-side       | Security audit passes                                              |
| Clerk users mapped to every payment                 | 100% of `orders` rows have a non-null `userId`                     |
| All API inputs validated with Zod                   | No unvalidated routes in coverage report                           |
| DB-backed idempotency survives restarts             | Same event before and after restart produces exactly one DB record |
| Full payment audit trail queryable                  | `GET /payments/orders` returns accurate, complete history          |
| DB migrations run cleanly on every deploy           | Zero failed migrations in CI logs                                  |
| P95 response time for `/create-order`               | Under 500ms including Razorpay API call                            |
| Service uptime                                      | Over 99.9%                                                         |

---

## 24. Design Decisions Log

| Decision                                  | Alternatives Considered                  | Reason for Choice                                                              |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| **Hono** as framework                     | Express, Fastify, Elysia                 | Lightweight, edge-ready, first-class TypeScript                                |
| **Feature-first folder structure**        | Layer-first (controllers/services/repos) | Features are independently maintainable and scalable                           |
| **Axios** for Razorpay calls              | Native fetch, Razorpay SDK               | Interceptors for centralized logging, auth injection, retry logic              |
| **Zod** for validation                    | Joi, Yup, class-validator                | TypeScript-first; types inferred from schemas at compile time                  |
| **Central webhook handler**               | Per-app webhook URLs                     | Single Razorpay URL; routing in code via `notes.app`                           |
| **Clerk via JWT**                         | Passport.js, custom JWT                  | Managed auth, token rotation, multi-app support built-in                       |
| **Prisma as ORM**                         | Drizzle, TypeORM, Knex, raw SQL          | Type-safe generated client, excellent migration tooling, great DX              |
| **PostgreSQL**                            | MySQL, SQLite, MongoDB                   | ACID-compliant, JSON support, reliable at production scale                     |
| **DB-backed idempotency**                 | In-memory Set                            | Survives restarts and deploys; race-condition safe via DB unique constraint    |
| **`rawPayload` stored in DB**             | Structured columns only                  | Enables full event replay without re-calling Razorpay API                      |
| **`FAILED` events retryable**             | Treat all processed events as closed     | Failed events need a second chance; `PROCESSED` records still block duplicates |
| **Prisma singleton pattern**              | New client per request                   | Prevents connection pool exhaustion in long-running server processes           |
| **Raw body for webhook verification**     | Parsed JSON                              | Razorpay HMAC is computed over raw bytes — JSON parsing breaks verification    |
| **`migrate deploy` in production**        | `migrate dev`                            | Non-interactive, safe for CI/CD pipelines; never resets data                   |
| **Repository pattern over direct Prisma** | Call Prisma directly in services         | Decouples business logic from ORM; easier to test and swap                     |

---

## 25. Glossary

| Term                     | Definition                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Paise**                | Smallest unit of INR. Rs 1 = 100 paise. All Razorpay amounts are in paise.                                        |
| **HMAC**                 | Hash-based Message Authentication Code. Used for all Razorpay signature verification.                             |
| **Idempotency**          | Property where processing the same event multiple times produces the same result. Critical for webhooks.          |
| **Clerk JWT**            | JSON Web Token issued by Clerk after user login, containing `userId` and session info.                            |
| **notes**                | Key-value metadata attached to a Razorpay order. Carries `app`, `userId`, `productId` through the full lifecycle. |
| **Webhook**              | HTTP POST sent by Razorpay to this service when a payment event occurs.                                           |
| **Feature-first**        | Folder structure organized by business feature (payments, auth, webhook) rather than by technical layer.          |
| **Clean Architecture**   | Layered design: API -> Service (domain) -> Repository -> Infrastructure (Prisma, Axios).                          |
| **Repository Pattern**   | Abstraction layer between service logic and Prisma. Services call repositories, never Prisma directly.            |
| **Prisma**               | TypeScript ORM that generates a type-safe DB client from `schema.prisma`.                                         |
| **Prisma Migrate**       | Prisma's migration engine. Use `migrate dev` in development and `migrate deploy` in production.                   |
| **`DIRECT_URL`**         | A non-pooled DB connection string used by Prisma Migrate to bypass PgBouncer.                                     |
| **Connection Pooling**   | Technique to reuse DB connections. Required for serverless and high-concurrency deployments.                      |
| **PgBouncer**            | A lightweight PostgreSQL connection pooler. Sits between the app and PostgreSQL.                                  |
| **Prisma Accelerate**    | Prisma's managed connection pooling and edge caching add-on service.                                              |
| **`rawPayload`**         | The raw JSON string of a webhook event stored verbatim for audit, debugging, and replay.                          |
| **`OrderStatus`**        | Prisma enum: `CREATED`, `ATTEMPTED`, `PAID`, `FAILED`, `REFUNDED`.                                                |
| **`WebhookEventStatus`** | Prisma enum: `RECEIVED`, `PROCESSED`, `FAILED`. Drives idempotency logic.                                         |
| **Edge-ready**           | Capable of running on edge runtimes (Cloudflare Workers, Vercel Edge) without modification.                       |

---

_End of PRD — Central Payments & Auth Service v1.1.0_
