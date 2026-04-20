import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  NextFetchEvent,
  NextProxy as NextMiddleware,
  NextRequest,
} from "next/server";
import { ProxyFactory } from "./stackProxies";

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/health",
  "/api/webhook/razorpay(.*)",
  "/api/auth/(.*)",
]);

export const withAuth: ProxyFactory = (next: NextMiddleware) => {
  return async (request: NextRequest, _next: NextFetchEvent) => {
    return clerkMiddleware(async (auth, req, event) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
      return next(req, event);
    })(request, _next);
  };
};
