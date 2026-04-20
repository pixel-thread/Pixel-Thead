import {
  NextFetchEvent,
  NextProxy as NextMiddleware,
  NextRequest,
  NextResponse,
} from "next/server";
import { ProxyFactory } from "./stackProxies";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  // Add other production domains here
];

export const withCors: ProxyFactory = (next: NextMiddleware) => {
  return async (request: NextRequest, _next: NextFetchEvent) => {
    const origin = request.headers.get("origin");

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 });

      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
      }

      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      response.headers.set("Access-Control-Max-Age", "86400");

      return response;
    }

    // Handle actual requests
    const response = await next(request, _next);

    if (origin && allowedOrigins.includes(origin)) {
      response?.headers.set("Access-Control-Allow-Origin", origin);
      response?.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      response?.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      response?.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
  };
};
