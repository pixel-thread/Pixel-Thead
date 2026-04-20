import { auth } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";
import { AuthService } from "@/features/auth/services/auth.service";
import { withErrorHandler, handleMethodNotAllowed } from "@/shared/lib/errorHandler";
import { ApiResponse } from "@/shared/utils/response.util";
import { UnauthorizedError } from "@/shared/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 * Identity Service for Microservice Architecture.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  let userId = req.headers.get("x-user-id");

  if (!userId) {
    const session = await auth();
    userId = session.userId;
  }

  if (!userId) {
    throw new UnauthorizedError("Session identifying data missing.");
  }

  const profile = await AuthService.getCurrentUser(userId);
  return NextResponse.json(ApiResponse.success(profile));
});

// Spread the shared handlers (POST, PUT, PATCH, DELETE)
export const { POST, PUT, PATCH, DELETE } = handleMethodNotAllowed;
