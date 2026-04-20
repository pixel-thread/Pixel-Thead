import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

export interface ApiErrorOptions {
  message: string;
  status?: number;
  code?: string;
  error?: any;
}

/**
 * Centalized Global Error Handler
 * Standardizes all error responses across API routes and Proxies.
 */
export function handleError(options: ApiErrorOptions | Error | unknown) {
  // 1. Default fallback values
  let message = "An unexpected error occurred";
  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let details: any = null;

  // 2. Extract info based on error type
  if (options instanceof ZodError) {
    message = "Request validation failed";
    status = 400;
    code = "VALIDATION_ERROR";
    details = options.issues;
  } else if (options instanceof AppError) {
    message = options.message;
    status = options.status;
    code = options.code;
  } else if (options instanceof Error) {
    message = options.message;
    // Check for custom status on error object if exists
    status = (options as any).status || 500;
    code = (options as any).code || "APP_ERROR";
  } else if (typeof options === "object" && options !== null) {
    const opt = options as ApiErrorOptions;
    message = opt.message || message;
    status = opt.status || status;
    code = opt.code || code;
    details = opt.error || null;
  }

  // 3. Log errors in non-production (or use a structured logger)
  if (process.env.NODE_ENV !== "production") {
    console.error(`[API Error] ${code} (${status}):`, message, details || "");
  }

  // 4. Return unified JSON response
  return NextResponse.json(
    {
      success: false,
      message,
      code,
      error: details,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Higher-order wrapper specifically for API route catch blocks
 */

export const withErrorHandler =
  // eslint-disable-next-line
  (fn: Function) =>
    // eslint-disable-next-line
    async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        return handleError(error);
      }
    };

/**
 * Shared utility to handle unsupported HTTP methods
 */
export const methodNotAllowed = (method: string) =>
  withErrorHandler(async () => {
    throw new AppError(`Method ${method} not allowed`, 405, "METHOD_NOT_ALLOWED");
  });

/**
 * Common method handlers to spread into route files
 * Usage: ...handleMethodNotAllowed
 */
export const handleMethodNotAllowed = {
  POST: methodNotAllowed("POST"),
  PUT: methodNotAllowed("PUT"),
  PATCH: methodNotAllowed("PATCH"),
  DELETE: methodNotAllowed("DELETE"),
  GET: methodNotAllowed("GET"),
};
