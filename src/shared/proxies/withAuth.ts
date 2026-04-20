import { createClerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { env } from "@/shared/config/env";
import { UnauthorizedError } from "@/shared/lib/errors";
import { handleError } from "@/shared/lib/errorHandler";
import {
  NextFetchEvent,
  NextRequest,
} from "next/server";
import { ProxyFactory } from "./stackProxies";

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

/**
 * matches the precise public endpoints and any paths inside /api/auth/ and webhooks
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/api/health",
  "/api/webhook/razorpay(.*)",
  "/api/auth/(.*)",
]);

/**
 * withAuth Proxy Factory - Microservices Identity Layer
 * 
 * Logic:
 * 1. Allow public routes immediately.
 * 2. Authenticate private routes using Bearer JWT (Expo) or Session Cookie (Web).
 * 3. Standardize Identity via x-user-id header.
 */
export const withAuth: ProxyFactory = (next) => {
  return async (req: NextRequest, event: NextFetchEvent) => {
    
    return clerkMiddleware(async (auth, request) => {
      const url = new URL(request.url);

      // 1. Skip Auth for defined Public Routes
      if (isPublicRoute(request)) {
        return next(request, event);
      }

      // 2. FOR ALL OTHER API ROUTES: Attempt Authentication
      try {
        const authHeader = request.headers.get("Authorization");
        let userId: string | null = null;

        /* --- MODE 1: EXPO/MOBILE (Bearer JWT) --- */
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.split(" ")[1];
          try {
            const payload = await clerk.verifyToken(token);
            userId = payload.sub;
          } catch {
            throw new UnauthorizedError("Invalid mobile session token.");
          }
        } 
        
        /* --- MODE 2: WEB (Session Cookie) --- */
        else {
          const authData = await auth();
          userId = authData.userId;
        }

        // If it's a private route and no identity is found, block it.
        // BUT, we only want to block it if it's NOT a call that should fall 
        // back to the global [...catch] handler for 404s.
        if (!userId) {
          throw new UnauthorizedError("Authentication required.");
        }

        request.headers.set("x-user-id", userId);
        return next(request, event);

      } catch (error) {
        /**
         * SPECIAL HANDLING:
         * If the route doesn't exist, we'd rather the user get a 404 than a 401.
         * However, security usually dictates 401 comes first.
         * For this dev-friendly setup, we allow the request to proceed 
         * to let Next.js handle the route resolution if no userId is found, 
         * but our logic here is standard.
         */
        return handleError(error);
      }
    })(req, event);
  };
};
