import {
  NextFetchEvent,
  NextRequest,
} from "next/server";
import { ProxyFactory } from "./stackProxies";
import { handleError } from "../lib/errorHandler";
import { NotFoundError } from "../lib/errors";

/**
 * withNotFound Proxy Factory
 * 
 * In a Next.js middleware chain, if we reach the end of the proxy stack
 * and we are targeting a non-existent API route, this proxy handles the 
 * "early exit" with a clean JSON 404.
 */
export const withNotFound: ProxyFactory = (next) => {
  return async (req: NextRequest, event: NextFetchEvent) => {
    const url = new URL(req.url);

    // Only intercept for API routes to avoid breaking standard page routing
    const isApiRoute = url.pathname.startsWith("/api/");
    
    const response = await next(req, event);

    /**
     * LOGIC:
     * If next() returns a middleware response that is marked as 'x-middleware-next'
     * OR if it's a 404 status from within the middleware logic, 
     * we can capture it here.
     */
    if (isApiRoute && response.status === 404) {
      return handleError(
        new NotFoundError(`API Route [${req.method}] ${url.pathname} not found in microservice proxy.`)
      );
    }

    return response;
  };
};
