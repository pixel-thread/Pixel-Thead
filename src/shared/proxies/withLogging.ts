import {
  NextFetchEvent,
  NextProxy as NextMiddleware,
  NextRequest,
} from "next/server";
import { ProxyFactory } from "./stackProxies";

export const withLogging: ProxyFactory = (next: NextMiddleware) => {
  return async (request: NextRequest, _next: NextFetchEvent) => {
    const start = Date.now();
    const { method, nextUrl } = request;

    console.log(`[Proxy] ${method} ${nextUrl.pathname} started`);

    const response = await next(request, _next);

    const duration = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[Proxy] ${method} ${nextUrl.pathname} completed in ${duration}ms`
      );
    }

    return response;
  };
};
