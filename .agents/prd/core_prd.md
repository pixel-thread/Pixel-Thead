# 📄 Product Requirements Document (PRD)

# Central Payments & Auth Service

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2025  
**Authors:** Engineering Team  
**Stack:** Hono · Razorpay · Clerk · Zod · Axios · TypeScript

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
13. [API Contract (Full Reference)](#13-api-contract)
14. [Data Flow Diagrams](#14-data-flow-diagrams)
15. [Error Handling Strategy](#15-error-handling-strategy)
16. [Security Requirements](#16-security-requirements)
17. [Validation Strategy (Zod)](#17-validation-strategy)
18. [Logging & Observability](#18-logging--observability)
19. [Testing Strategy](#19-testing-strategy)
20. [Deployment & DevOps](#20-deployment--devops)
21. [Future Enhancements](#21-future-enhancements)
22. [Success Criteria](#22-success-criteria)
23. [Design Decisions Log](#23-design-decisions-log)
24. [Glossary](#24-glossary)

---

## 1. Executive Summary

The **Central Payments & Auth Service** is a unified backend service built with **Hono** that consolidates all Razorpay payment flows, webhook handling, and Clerk-based authentication across multiple client applications (web and mobile). Instead of each app independently managing its own payment and auth logic, this service acts as the single source of truth — reducing code duplication, improving security, and ensuring consistency in payment verification and user identity association.

---

## 2. Problem Statement

### Current State (Before This Service)

| Problem                                                      | Impact                                        |
| ------------------------------------------------------------ | --------------------------------------------- |
| Each frontend app has its own Razorpay integration           | Duplicate logic, inconsistent implementations |
| Payment signature verification done client-side in some apps | Critical security vulnerability               |
| No centralized webhook handler                               | Events get missed or processed multiple times |
| Clerk JWT verified differently per app                       | Inconsistent user identity, auth bugs         |
| No unified logging for payment events                        | Debugging is slow and incomplete              |
| Multiple Razorpay credentials scattered across apps          | Secret sprawl, rotation nightmares            |

### Root Cause

There is no shared backend layer that owns the full payment lifecycle: order creation → checkout → verification → webhook → post-payment action.

---

## 3. Goals & Non-Goals

### ✅ Goals

- Build a single Hono-based service that owns all Razorpay interactions
- Validate all Clerk JWTs and expose authenticated user context to protected routes
- Handle Razorpay webhooks centrally and route events to the correct app handler
- Ensure all inputs and outputs are validated with Zod schemas
- Support multiple client apps through `notes.app` metadata routing
- Never expose Razorpay credentials or secrets to any client
- Be fully type-safe end-to-end using TypeScript

### ❌ Non-Goals (v1.0)

- No admin dashboard (planned for v2)
- No subscription billing management (planned for v2)
- No direct database writes from this service (downstream services handle persistence)
- No multi-currency support (v1 supports INR only)
- No multi-Razorpay account support (single key pair in v1)

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
| **Node.js / Bun** | Runtime         | Server-side JavaScript; Bun preferred for speed                         |

---

## 5. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Applications                    │
│          Web App 1  ·  Web App 2  ·  Mobile App          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS Requests + Clerk JWT
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Hono Central Service                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                  Middleware Layer                     │ │
│  │  CORS · Logger · Rate Limiter · Auth (Clerk JWT)     │ │
│  └──────────────────┬──────────────────────────────────┘ │
│                     │                                     │
│  ┌──────────────────▼──────────────────────────────────┐ │
│  │                  Features Layer                       │ │
│  │   ┌──────────┐  ┌───────────┐  ┌─────────────────┐  │ │
│  │   │  Auth    │  │ Payments  │  │    Webhooks     │  │ │
│  │   │ Feature  │  │ Feature   │  │    Feature      │  │ │
│  │   └──────────┘  └───────────┘  └─────────────────┘  │ │
│  └──────────────────┬──────────────────────────────────┘ │
│                     │                                     │
│  ┌──────────────────▼──────────────────────────────────┐ │
│  │              Domain / Service Layer                   │ │
│  │   Business Logic · Signature Verification ·          │ │
│  │   Event Routing · User Association                   │ │
│  └──────────────────┬──────────────────────────────────┘ │
│                     │                                     │
│  ┌──────────────────▼──────────────────────────────────┐ │
│  │            Infrastructure / Adapter Layer             │ │
│  │   Axios Client · Razorpay API · Clerk SDK            │ │
│  └──────────────────┬──────────────────────────────────┘ │
└─────────────────────┼───────────────────────────────────┘
                      │
         ┌────────────┴──────────────┐
         ▼                           ▼
  ┌─────────────┐           ┌──────────────┐
  │  Razorpay   │           │    Clerk     │
  │    API      │           │  Auth API    │
  └─────────────┘           └──────────────┘
```

### Request Lifecycle

```
Request In
    │
    ▼
CORS Middleware
    │
    ▼
Logger Middleware (log method, path, ip)
    │
    ▼
Rate Limiter Middleware
    │
    ▼
Body Parser / JSON Middleware
    │
    ▼
Route Match
    │
    ├── Public Route → Feature Handler directly
    │
    └── Protected Route
             │
             ▼
        Auth Middleware (Clerk JWT verification)
             │
             ├── Invalid Token → 401 Unauthorized
             │
             └── Valid Token
                      │
                      ▼
                 c.set("user", clerkUser)
                      │
                      ▼
                 Feature Handler
                      │
                      ▼
                 Zod Validation
                      │
                      ▼
                 Service / Domain Logic
                      │
                      ▼
                 Response Out
```

---

## 6. Folder Structure

### Complete Feature-First + Clean Architecture

```
src/
│
├── app/
│   ├── index.ts                    # Hono app initialization
│   ├── routes.ts                   # Central route registration
│   └── server.ts                   # Server entry point (listen/export)
│
├── features/
│   │
│   ├── auth/
│   │   ├── api/
│   │   │   └── auth.routes.ts      # /auth/* route handlers
│   │   ├── middleware/
│   │   │   └── clerk.middleware.ts # Clerk JWT middleware
│   │   ├── services/
│   │   │   └── clerk.service.ts    # verifyClerkToken(), getUser()
│   │   ├── validators/
│   │   │   └── auth.schema.ts      # Zod schemas for auth inputs
│   │   ├── types/
│   │   │   └── auth.types.ts       # ClerkUser, AuthContext types
│   │   └── index.ts                # Public exports for the feature
│   │
│   ├── payments/
│   │   ├── api/
│   │   │   └── payments.routes.ts  # /payments/* route handlers
│   │   ├── services/
│   │   │   ├── order.service.ts    # createOrder() logic
│   │   │   └── verify.service.ts   # verifyPayment() logic
│   │   ├── validators/
│   │   │   ├── createOrder.schema.ts
│   │   │   └── verifyPayment.schema.ts
│   │   ├── types/
│   │   │   └── payments.types.ts   # Order, Payment, VerifyPayload types
│   │   ├── utils/
│   │   │   └── signature.util.ts   # HMAC signature generation/verification
│   │   └── index.ts
│   │
│   └── webhook/
│       ├── api/
│       │   └── webhook.routes.ts   # /webhook/* route handlers
│       ├── services/
│       │   ├── webhook.service.ts  # processWebhookEvent()
│       │   └── router.service.ts   # routeEventByApp()
│       ├── validators/
│       │   └── webhook.schema.ts   # Zod schemas for webhook payloads
│       ├── types/
│       │   └── webhook.types.ts    # WebhookEvent, PaymentEvent types
│       ├── handlers/
│       │   ├── app1.handler.ts     # App-specific event handlers
│       │   └── app2.handler.ts
│       └── index.ts
│
├── shared/
│   ├── api/
│   │   └── axios.ts                # Axios client (Razorpay base config)
│   ├── config/
│   │   └── env.ts                  # Typed env variable access
│   ├── constants/
│   │   ├── app.constants.ts        # App name enums
│   │   └── razorpay.constants.ts   # Razorpay API URLs, event names
│   ├── middleware/
│   │   ├── cors.middleware.ts
│   │   ├── logger.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   └── error.middleware.ts
│   ├── types/
│   │   ├── hono.types.ts           # Extended Hono context bindings
│   │   └── api.types.ts            # Generic ApiResponse<T> types
│   ├── utils/
│   │   ├── response.util.ts        # Standardized response helpers
│   │   └── crypto.util.ts          # HMAC / hash utilities
│   └── validators/
│       └── common.schema.ts        # Shared Zod schemas (pagination, IDs)
│
└── index.ts                        # Root entry point
```

---

## 7. Environment Configuration

### `.env` File (Full Reference)

```env
# ── Server ──────────────────────────────────────────────
PORT=3000
NODE_ENV=development                  # development | production | test
SERVICE_BASE_URL=https://pay.yourapi.com

# ── Razorpay ─────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
RAZORPAY_BASE_URL=https://api.razorpay.com/v1

# ── Clerk ────────────────────────────────────────────────
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_JWT_ISSUER=https://clerk.your-domain.com   # Your Clerk frontend API

# ── CORS ─────────────────────────────────────────────────
ALLOWED_ORIGINS=https://app1.com,https://app2.com,https://mobile.app.com

# ── Rate Limiting ────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=60000           # 1 minute
RATE_LIMIT_MAX_REQUESTS=100

# ── Logging ──────────────────────────────────────────────
LOG_LEVEL=info                        # debug | info | warn | error
LOG_FORMAT=json                       # json | pretty
```

### `shared/config/env.ts` — Typed Environment Access

```typescript
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SERVICE_BASE_URL: z.string().url(),

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
  console.error("❌ Invalid environment variables:", parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;
```

---

## 8. Middleware Layer

All middleware lives in `shared/middleware/` and is registered globally in `app/index.ts`.

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

**Notes:**

- Origins are loaded from `ALLOWED_ORIGINS` env var
- Only `POST` and `GET` needed for this service
- Preflight (`OPTIONS`) handled automatically

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

  const ms = Date.now() - start;
  const status = c.res.status;

  const log = {
    method,
    path,
    status,
    ms,
    ip,
    timestamp: new Date().toISOString(),
  };

  if (env.LOG_FORMAT === "json") {
    console.log(JSON.stringify(log));
  } else {
    console.log(`[${log.timestamp}] ${method} ${path} → ${status} (${ms}ms)`);
  }
});
```

---

### 8.3 Rate Limiter Middleware

**File:** `shared/middleware/rateLimit.middleware.ts`

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

**Notes:**

- In-memory store used for v1. Replace with Redis for distributed deployments.
- Keyed by IP address.

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

**How to Apply:**

- Applied **only to protected routes** (create-order, verify payment)
- Webhook routes do NOT use this middleware (they use Razorpay signature verification instead)

---

### 8.5 Error Handler Middleware

**File:** `shared/middleware/error.middleware.ts`

```typescript
import { Hono } from "hono";

export function registerErrorHandlers(app: Hono) {
  app.notFound((c) =>
    c.json({ success: false, error: "Route not found." }, 404),
  );

  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ success: false, error: "Internal server error." }, 500);
  });
}
```

---

### 8.6 Middleware Registration

**File:** `app/index.ts`

```typescript
import { Hono } from "hono";
import { corsMiddleware } from "../shared/middleware/cors.middleware";
import { loggerMiddleware } from "../shared/middleware/logger.middleware";
import { rateLimitMiddleware } from "../shared/middleware/rateLimit.middleware";
import { registerErrorHandlers } from "../shared/middleware/error.middleware";
import { registerRoutes } from "./routes";

const app = new Hono();

// ── Global Middleware (order matters) ──────────────────
app.use("*", corsMiddleware);
app.use("*", loggerMiddleware);
app.use("*", rateLimitMiddleware);

// ── Feature Routes ──────────────────────────────────────
registerRoutes(app);

// ── Error Handlers ──────────────────────────────────────
registerErrorHandlers(app);

export default app;
```

---

## 9. Feature: Auth

### 9.1 Purpose

The Auth feature validates incoming Clerk JWT tokens and exposes authenticated user context (`userId`, `sessionId`, `email`) to all protected routes in this service.

### 9.2 Clerk Service

**File:** `features/auth/services/clerk.service.ts`

```typescript
import Clerk from "@clerk/clerk-sdk-node";
import { env } from "../../../shared/config/env";

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
    } catch (err) {
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

// Extend Hono context variables (shared/types/hono.types.ts)
export type HonoVariables = {
  user: ClerkUserPayload;
};
```

### 9.4 Auth Route (Optional — Health Check / Token Introspect)

**File:** `features/auth/api/auth.routes.ts`

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../middleware/clerk.middleware";

const authRoutes = new Hono();

// GET /auth/me — Returns authenticated user info
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

1. Create a Razorpay order and return `orderId` to the client
2. Verify the payment signature after client checkout is complete

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

const paymentRoutes = new Hono();

// POST /payments/create-order (Protected)
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

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({ success: true, data: result.data }, 201);
  },
);

// POST /payments/verify (Protected)
paymentRoutes.post(
  "/verify",
  authMiddleware,
  zValidator("json", verifyPaymentSchema),
  async (c) => {
    const body = c.req.valid("json");

    const result = await verifyService.verifyPayment(body);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({ success: true, data: result.data }, 200);
  },
);

export default paymentRoutes;
```

### 10.3 Validators

**File:** `features/payments/validators/createOrder.schema.ts`

```typescript
import { z } from "zod";

export const createOrderSchema = z.object({
  amount: z
    .number({ required_error: "Amount is required." })
    .min(100, "Minimum amount is ₹1 (100 paise).")
    .int("Amount must be an integer (paise)."),
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

### 10.4 Order Service

**File:** `features/payments/services/order.service.ts`

```typescript
import { axiosClient } from "../../../shared/api/axios";
import { CreateOrderInput } from "../validators/createOrder.schema";
import { RazorpayOrder } from "../types/payments.types";

export const orderService = {
  async createOrder(input: CreateOrderInput & { userId: string }) {
    try {
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

### 10.5 Verify Service

**File:** `features/payments/services/verify.service.ts`

```typescript
import { createHmac } from "crypto";
import { env } from "../../../shared/config/env";
import { VerifyPaymentInput } from "../validators/verifyPayment.schema";

export const verifyService = {
  verifyPayment(input: VerifyPaymentInput) {
    const { orderId, paymentId, signature } = input;

    const expectedSignature = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expectedSignature !== signature) {
      return {
        success: false as const,
        error: "Payment signature verification failed.",
      };
    }

    return {
      success: true as const,
      data: {
        orderId,
        paymentId,
        verified: true,
        verifiedAt: new Date().toISOString(),
      },
    };
  },
};
```

### 10.6 Types

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

Receives, verifies, and routes all Razorpay webhook events. This is the most critical feature — it must be idempotent, secure, and reliable.

### 11.2 Webhook Route

**File:** `features/webhook/api/webhook.routes.ts`

```typescript
import { Hono } from "hono";
import { webhookService } from "../services/webhook.service";

const webhookRoutes = new Hono();

// POST /webhook/razorpay
// NOTE: No authMiddleware — Razorpay signs the request instead
webhookRoutes.post("/razorpay", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-razorpay-signature");

  if (!signature) {
    return c.json({ success: false, error: "Missing webhook signature." }, 400);
  }

  const result = await webhookService.process({ rawBody, signature });

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 400);
  }

  // Always respond 200 quickly — processing is async
  return c.json({ success: true }, 200);
});

export default webhookRoutes;
```

**Critical:** Razorpay expects a `200 OK` response within a few seconds or it retries. Keep the route handler fast; hand off to async processing.

### 11.3 Webhook Service

**File:** `features/webhook/services/webhook.service.ts`

```typescript
import { createHmac } from "crypto";
import { env } from "../../../shared/config/env";
import { routerService } from "./router.service";
import { WebhookEvent } from "../types/webhook.types";

// In-memory idempotency store (replace with Redis in production)
const processedEvents = new Set<string>();

export const webhookService = {
  async process({
    rawBody,
    signature,
  }: {
    rawBody: string;
    signature: string;
  }) {
    // Step 1: Verify signature
    const isValid = this.verifySignature(rawBody, signature);
    if (!isValid) {
      console.warn("Webhook signature mismatch. Possible spoofed request.");
      return { success: false as const, error: "Invalid webhook signature." };
    }

    // Step 2: Parse payload
    let event: WebhookEvent;
    try {
      event = JSON.parse(rawBody) as WebhookEvent;
    } catch {
      return { success: false as const, error: "Malformed JSON payload." };
    }

    // Step 3: Idempotency check
    if (processedEvents.has(event.payload.payment?.entity?.id ?? event.event)) {
      console.info("Duplicate webhook event skipped:", event.event);
      return { success: true as const };
    }

    // Step 4: Route event
    try {
      await routerService.route(event);
      processedEvents.add(event.payload.payment?.entity?.id ?? event.event);
    } catch (err) {
      console.error("Webhook routing error:", err);
      // Don't return 400 — we don't want Razorpay to retry for app errors
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
import { app1Handler } from "../handlers/app1.handler";
import { app2Handler } from "../handlers/app2.handler";

export const routerService = {
  async route(event: WebhookEvent) {
    const app = event.payload.payment?.entity?.notes?.app;
    const eventType = event.event;

    console.info(`Routing event: ${eventType} for app: ${app}`);

    switch (app) {
      case "web-app-1":
        return app1Handler.handle(eventType, event);
      case "web-app-2":
        return app2Handler.handle(eventType, event);
      case "mobile-app":
        // handle mobile-specific logic
        break;
      default:
        console.warn(`Unknown app in webhook notes: ${app}`);
    }
  },
};
```

### 11.5 App Handlers

**File:** `features/webhook/handlers/app1.handler.ts`

```typescript
import { WebhookEvent } from "../types/webhook.types";

export const app1Handler = {
  async handle(eventType: string, event: WebhookEvent) {
    const payment = event.payload.payment?.entity;

    switch (eventType) {
      case "payment.captured":
        console.info(`[App1] Payment captured: ${payment?.id}`);
        // TODO: Notify App1's backend to activate subscription/credits
        // await axios.post("https://app1-backend.com/internal/activate", { paymentId: payment?.id, userId: payment?.notes?.userId });
        break;

      case "payment.failed":
        console.warn(`[App1] Payment failed: ${payment?.id}`);
        // TODO: Notify App1's backend to handle failed payment
        break;

      case "refund.processed":
        console.info(`[App1] Refund processed for: ${payment?.id}`);
        break;

      default:
        console.info(`[App1] Unhandled event type: ${eventType}`);
    }
  },
};
```

### 11.6 Webhook Types

**File:** `features/webhook/types/webhook.types.ts`

```typescript
export interface WebhookEventNotes {
  app: string;
  userId: string;
  productId: string;
}

export interface RazorpayPaymentEntity {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  notes: WebhookEventNotes;
  method: string;
  captured: boolean;
}

export interface WebhookPayload {
  payment?: {
    entity: RazorpayPaymentEntity;
  };
  refund?: {
    entity: {
      id: string;
      payment_id: string;
      amount: number;
    };
  };
}

export interface WebhookEvent {
  entity: "event";
  account_id: string;
  event: string;
  contains: string[];
  payload: WebhookPayload;
  created_at: number;
}
```

### 11.7 Supported Webhook Events

| Event                    | Description                         | Handled |
| ------------------------ | ----------------------------------- | ------- |
| `payment.captured`       | Payment successfully captured       | ✅      |
| `payment.failed`         | Payment failed                      | ✅      |
| `payment.authorized`     | Payment authorized but not captured | ✅      |
| `refund.processed`       | Refund has been processed           | ✅      |
| `refund.failed`          | Refund failed                       | ✅      |
| `order.paid`             | Order fully paid                    | ✅      |
| `subscription.activated` | Subscription went live              | 🔜 v2   |
| `subscription.cancelled` | Subscription cancelled              | 🔜 v2   |

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
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor — log outgoing requests
axiosClient.interceptors.request.use((config) => {
  console.debug(`[Axios] → ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor — log + normalize errors
axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const message =
      (error.response?.data as any)?.error?.description ?? error.message;
    console.error(`[Axios] ✗ ${status}: ${message}`);
    return Promise.reject(error);
  },
);
```

### 12.2 Standardized Response Utility

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

  // Health check (public)
  app.get("/health", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() }),
  );
}
```

---

## 13. API Contract

### Base URL

```
https://pay.yourapi.com
```

### Authentication

All protected routes require:

```
Authorization: Bearer <clerk_jwt_token>
```

---

### `GET /health`

**Access:** Public  
**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### `GET /auth/me`

**Access:** Protected (Clerk JWT)  
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

**Response `401`:**

```json
{
  "success": false,
  "error": "Invalid or expired token."
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

| Field       | Type     | Required | Description                             |
| ----------- | -------- | -------- | --------------------------------------- |
| `amount`    | `number` | ✅       | Amount in paise (₹499 = `49900`)        |
| `currency`  | `string` | ❌       | Defaults to `"INR"`                     |
| `app`       | `string` | ✅       | App identifier for routing              |
| `productId` | `string` | ✅       | Product reference                       |
| `receipt`   | `string` | ❌       | Max 40 chars, auto-generated if omitted |

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

**Response `400`:**

```json
{
  "success": false,
  "error": "Minimum amount is ₹1 (100 paise)."
}
```

---

### `POST /payments/verify`

**Access:** Protected  
**Request Body:**

```json
{
  "orderId": "order_XXXXXXXXXXXXXX",
  "paymentId": "pay_XXXXXXXXXXXXXX",
  "signature": "hmac_sha256_signature"
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

**Response `400`:**

```json
{
  "success": false,
  "error": "Payment signature verification failed."
}
```

---

### `POST /webhook/razorpay`

**Access:** Public (Razorpay-signed)  
**Headers Required:**

```
x-razorpay-signature: <hmac_sha256_signature>
Content-Type: application/json
```

**Response `200`:**

```json
{
  "success": true
}
```

**Response `400`:**

```json
{
  "success": false,
  "error": "Invalid webhook signature."
}
```

---

## 14. Data Flow Diagrams

### Payment Creation Flow

```
Client App
  │
  │  POST /payments/create-order
  │  { amount, app, productId }
  │  Authorization: Bearer <clerk_jwt>
  ▼
Hono Service
  │
  ├── Auth Middleware
  │     └── Verify Clerk JWT
  │         ├── Invalid → 401 Unauthorized
  │         └── Valid → c.set("user", payload)
  │
  ├── Zod Validation
  │     └── Invalid body → 422 Unprocessable
  │
  └── orderService.createOrder()
        │
        ▼
      Axios → POST https://api.razorpay.com/v1/orders
        {
          amount,
          currency,
          receipt,
          notes: { app, userId, productId }
        }
        │
        ├── Razorpay Error → 400 { error }
        └── Success → 201 { orderId, amount, currency }
```

### Payment Verify Flow

```
Client App (after Razorpay Checkout)
  │
  │  POST /payments/verify
  │  { orderId, paymentId, signature }
  ▼
Hono Service
  │
  ├── Auth Middleware (validates Clerk JWT)
  ├── Zod Validation
  │
  └── verifyService.verifyPayment()
        │
        ├── Compute: HMAC_SHA256(key_secret, orderId + "|" + paymentId)
        ├── Compare with incoming signature
        ├── Mismatch → 400 { error: "Signature verification failed" }
        └── Match → 200 { verified: true, verifiedAt }
```

### Webhook Flow

```
Razorpay (after payment event)
  │
  │  POST /webhook/razorpay
  │  Headers: x-razorpay-signature
  │  Body: raw JSON payload
  ▼
Hono Service
  │
  ├── Extract raw body (no JSON parsing yet)
  ├── Verify x-razorpay-signature
  │     └── Invalid → 400 (abort — possible spoofed request)
  │
  ├── Parse JSON payload
  ├── Extract event.payload.payment.entity.notes.app
  │
  ├── Idempotency Check (by paymentId)
  │     └── Duplicate → skip processing, return 200
  │
  └── routerService.route(event)
        │
        ├── app = "web-app-1" → app1Handler.handle()
        ├── app = "web-app-2" → app2Handler.handle()
        └── unknown → log warning, no crash

Return 200 immediately (processing is async)
```

---

## 15. Error Handling Strategy

### Guiding Principles

1. **Never expose internal errors** to clients in production
2. **Log everything** — even swallowed errors
3. **Fail fast on validation** — Zod schema errors return `400` immediately
4. **Webhook errors never cause retries** — always return `200` for valid signed events
5. **Auth errors return `401`**, not `403` (avoids disclosing resource existence)

### Error Response Shape

All error responses follow this shape:

```typescript
interface ErrorResponse {
  success: false;
  error: string; // Human-readable message
  code?: number; // Optional internal error code
  issues?: ZodIssue[]; // Populated on validation errors
}
```

### HTTP Status Code Map

| Scenario                                    | Status Code                 |
| ------------------------------------------- | --------------------------- |
| Invalid Zod schema                          | `400 Bad Request`           |
| Missing Authorization header                | `401 Unauthorized`          |
| Invalid/expired Clerk JWT                   | `401 Unauthorized`          |
| Invalid Razorpay signature (payment verify) | `400 Bad Request`           |
| Invalid webhook signature                   | `400 Bad Request`           |
| Route not found                             | `404 Not Found`             |
| Too many requests                           | `429 Too Many Requests`     |
| Razorpay API failure                        | `502 Bad Gateway`           |
| Unexpected server error                     | `500 Internal Server Error` |

---

## 16. Security Requirements

### 16.1 Secrets Management

- All secrets stored in environment variables — never hardcoded
- `.env` added to `.gitignore` — never committed
- Use a secrets manager (e.g., Doppler, AWS Secrets Manager) in production
- Rotate Razorpay keys quarterly

### 16.2 Payment Verification

- **All** payment verifications happen **server-side** using HMAC-SHA256
- Client NEVER has access to `RAZORPAY_KEY_SECRET`
- Signature: `HMAC_SHA256(key_secret, orderId + "|" + paymentId)`

### 16.3 Webhook Security

- **Always** verify `x-razorpay-signature` before processing any event
- Use **raw body** (string) for HMAC verification — never parse first
- Webhook secret (`RAZORPAY_WEBHOOK_SECRET`) is separate from API secret

### 16.4 Auth Security

- Clerk JWTs verified using Clerk's public key (via SDK)
- Tokens are **short-lived** (controlled by Clerk settings)
- `Authorization: Bearer` header required for all protected routes
- No session persistence in this service — stateless

### 16.5 Transport Security

- All communication over **HTTPS only**
- HTTP connections rejected (enforced at reverse proxy level)
- Internal service calls (to app backends from webhook handlers) use service tokens

### 16.6 CORS Policy

- Explicit allowlist of origins — no wildcard `*` in production
- Only `POST` and `GET` methods exposed
- Credentials allowed only from known origins

---

## 17. Validation Strategy

### Philosophy

> **Validate at the boundary.** Every request body, every env var, every external API response that flows into the service is validated with Zod.

### Where Zod Is Used

| Location               | What's Validated                         |
| ---------------------- | ---------------------------------------- |
| `shared/config/env.ts` | All environment variables at startup     |
| `payments/validators/` | Request bodies for create-order & verify |
| `webhook/validators/`  | Incoming webhook payload structure       |
| `auth/validators/`     | Token format before passing to Clerk SDK |

### Zod Error Handling with `@hono/zod-validator`

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

## 18. Logging & Observability

### Log Levels

| Level   | When to Use                                                    |
| ------- | -------------------------------------------------------------- |
| `debug` | Axios request/response details (dev only)                      |
| `info`  | Successful operations, webhook received, order created         |
| `warn`  | Duplicate webhook, unknown app in routing, retried requests    |
| `error` | Signature mismatch, Razorpay API failure, unhandled exceptions |

### What Gets Logged

| Event                     | Level        | Fields                       |
| ------------------------- | ------------ | ---------------------------- |
| Incoming request          | `info`       | method, path, ip, timestamp  |
| Outgoing Razorpay request | `debug`      | method, url                  |
| Order created             | `info`       | orderId, app, userId         |
| Payment verified          | `info`       | orderId, paymentId, verified |
| Webhook received          | `info`       | event, app, paymentId        |
| Webhook signature fail    | `warn/error` | ip, raw body hash            |
| Duplicate webhook skipped | `info`       | eventId                      |
| Razorpay API error        | `error`      | status, message              |
| Unhandled error           | `error`      | stack trace                  |

### Recommended Tooling

- **Local:** Console JSON logs
- **Production:** [Axiom](https://axiom.co) / [Logtail](https://logtail.com) / Datadog
- **Alerts:** Set up alerts on `error` log volume spikes and webhook signature failures

---

## 19. Testing Strategy

### Testing Pyramid

```
         ┌──────────┐
         │  E2E     │  (Supertest / Hono test client)
         ├──────────┤
         │Integration│ (Mock Razorpay + Clerk)
         ├──────────┤
         │  Unit    │  (Services, validators, utils)
         └──────────┘
```

### Unit Tests (Required)

| File                    | What to Test                        |
| ----------------------- | ----------------------------------- |
| `verify.service.ts`     | Valid & invalid HMAC signatures     |
| `webhook.service.ts`    | Signature verification, idempotency |
| `createOrder.schema.ts` | Amount edge cases, required fields  |
| `env.ts`                | Missing env vars cause exit         |
| `response.util.ts`      | Shape of success/error responses    |

### Integration Tests (Required)

| Scenario                  | Mock                             |
| ------------------------- | -------------------------------- |
| Create order success      | Mock Razorpay API → 200          |
| Create order failure      | Mock Razorpay API → 500          |
| Invalid Clerk token       | Mock Clerk SDK → throws          |
| Webhook valid signature   | Real HMAC computation            |
| Webhook invalid signature | Injected bad signature           |
| Duplicate webhook         | Process twice, second is skipped |

### E2E Test Scenarios

```
✓ POST /payments/create-order with valid JWT and body → 201
✓ POST /payments/create-order with expired JWT → 401
✓ POST /payments/create-order with invalid body → 400
✓ POST /payments/verify with correct signature → 200 { verified: true }
✓ POST /payments/verify with wrong signature → 400
✓ POST /webhook/razorpay with valid signature → 200
✓ POST /webhook/razorpay with invalid signature → 400
✓ POST /webhook/razorpay duplicate event → 200 (skipped)
✓ GET /health → 200 { status: "ok" }
✓ GET /unknown → 404
```

---

## 20. Deployment & DevOps

### Recommended Stack

| Layer            | Tool                                   |
| ---------------- | -------------------------------------- |
| Runtime          | Node.js 20+ or **Bun**                 |
| Containerization | Docker                                 |
| Hosting          | Railway / Render / Fly.io / AWS Lambda |
| Reverse Proxy    | Nginx / Cloudflare                     |
| CI/CD            | GitHub Actions                         |
| Secrets          | Doppler / AWS Secrets Manager          |

### Dockerfile

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun build ./src/index.ts --outdir ./dist --target bun

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules

EXPOSE 3000
CMD ["bun", "dist/index.js"]
```

### GitHub Actions CI Pipeline

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck
      - run: bun test
      - run: bun run build
```

### Health Check Endpoint

Used by load balancers and uptime monitors:

```
GET /health → 200 { status: "ok" }
```

---

## 21. Future Enhancements

### v1.1 — Stability & Reliability

- [ ] Replace in-memory idempotency store with **Redis**
- [ ] Replace in-memory rate limiter with Redis-backed limiter
- [ ] Add retry logic with exponential backoff for Razorpay API calls
- [ ] Persist raw webhook payloads to a database for replay capability

### v2.0 — Feature Expansion

- [ ] **Subscription support** — Razorpay Subscriptions API integration
- [ ] **Refund handling** — `POST /payments/refund` endpoint
- [ ] **Queue system** — BullMQ or Kafka for async webhook processing
- [ ] **Multi-account support** — Route different apps to different Razorpay accounts
- [ ] **Admin dashboard** — View all payments, webhook events, failed retries

### v3.0 — Enterprise

- [ ] Multi-currency support
- [ ] PCI-DSS compliance review
- [ ] Audit log for all payment events
- [ ] SLA-based alerting

---

## 22. Success Criteria

| Criteria                                            | Measurement                          |
| --------------------------------------------------- | ------------------------------------ |
| All client apps route payments through this service | 0 direct Razorpay calls from clients |
| Zero duplicate payment logic across apps            | Code audit passes                    |
| All webhook events handled reliably                 | < 0.1% missed/dropped events         |
| Payment signature always verified server-side       | Security audit passes                |
| Clerk users mapped to every payment                 | 100% of orders have `notes.userId`   |
| All API inputs validated with Zod                   | No unvalidated routes                |
| P95 response time for `/create-order`               | < 500ms                              |
| Service uptime                                      | > 99.9%                              |

---

## 23. Design Decisions Log

| Decision                              | Alternatives Considered                  | Reason for Choice                                                                  |
| ------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| **Hono** as framework                 | Express, Fastify, Elysia                 | Lightweight, edge-ready, first-class TypeScript, great middleware support          |
| **Feature-first folder structure**    | Layer-first (controllers/services/repos) | Better scalability, easier to add/remove features independently                    |
| **Axios** for Razorpay calls          | Native fetch, Razorpay SDK               | Axios interceptors allow centralized logging, auth injection, retry logic          |
| **Zod** for validation                | Joi, Yup, class-validator                | TypeScript-first, infers types from schemas, used at both runtime and compile time |
| **Central webhook handler**           | Per-app webhooks                         | Eliminates duplicate signature logic, single point for idempotency and logging     |
| **Clerk via JWT**                     | Passport.js, custom JWT                  | Managed auth platform, handles token rotation, multi-app support built-in          |
| **Stateless service**                 | Session-based                            | Aligns with edge/serverless deployment, simpler scaling                            |
| **notes.app routing**                 | Separate webhook endpoints per app       | Single Razorpay webhook URL, routing happens in code                               |
| **Raw body for webhook verification** | Parsed JSON                              | Razorpay requires HMAC over raw bytes — parsing first corrupts verification        |

---

## 24. Glossary

| Term                   | Definition                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Paise**              | Smallest unit of INR. ₹1 = 100 paise. All Razorpay amounts are in paise.                                                   |
| **HMAC**               | Hash-based Message Authentication Code. Used for Razorpay signature verification.                                          |
| **Idempotency**        | Property where processing the same event multiple times produces the same result. Required for webhooks.                   |
| **Clerk JWT**          | JSON Web Token issued by Clerk after user login, containing userId and session info.                                       |
| **notes**              | Key-value metadata attached to a Razorpay order. Used to carry `app`, `userId`, `productId` through the payment lifecycle. |
| **Webhook**            | HTTP POST sent by Razorpay to your server when a payment event occurs (captured, failed, refunded).                        |
| **Feature-first**      | Folder structure where code is organized by business feature (payments, auth, webhook) rather than technical layer.        |
| **Clean Architecture** | Layered architecture separating API, services (domain), and infrastructure (Axios/external APIs).                          |
| **Edge-ready**         | Capable of running on edge runtimes (Cloudflare Workers, Vercel Edge) with no modifications.                               |

---

_End of PRD — Central Payments & Auth Service v1.0.0_
