import { NextResponse, NextRequest } from "next/server";
import { withErrorHandler } from "@/shared/lib/errorHandler";
import { NotFoundError } from "@/shared/lib/errors";

/**
 * API Catch-All Route Handler
 * Renamed to [...catch] for better clarity.
 * 
 * This handler catches any requests to /api/* that do not match a specific route file.
 * It also implicitly handles "Method Not Allowed" scenarios for defined routes,
 * because if a POST is made to a route that only has a GET handler, Next.js
 * will fallback to this catch-all if it exists.
 */
const handleUnmatchedRequest = withErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  
  // We provide a semantic error that covers both "Path Not Found" 
  // and potentially "Method Not Allowed" for that specific path.
  throw new NotFoundError(
    `The requested resource [${req.method}] ${url.pathname} was not found or the method is not supported.`
  );
});

export const GET = handleUnmatchedRequest;
export const POST = handleUnmatchedRequest;
export const PUT = handleUnmatchedRequest;
export const PATCH = handleUnmatchedRequest;
export const DELETE = handleUnmatchedRequest;
export const OPTIONS = handleUnmatchedRequest;
export const HEAD = handleUnmatchedRequest;
