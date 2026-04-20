import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AuthService } from "@/features/auth/services/auth.service";
import {
  handleMethodNotAllowed,
  withErrorHandler,
} from "@/shared/lib/errorHandler";
import { ApiResponse } from "@/shared/utils/response.util";
import { UnauthorizedError } from "@/shared/lib/errors";

/**
 * POST /api/auth/refresh
 * Re-issues a fresh JWT for the currently authenticated user.
 */
export const POST = withErrorHandler(async () => {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError(
      "Session expired. Identity could not be verified."
    );
  }

  const { token } = await AuthService.refreshToken(userId);

  return NextResponse.json(ApiResponse.success({ token }));
});

export const { GET, PUT, PATCH, DELETE } = handleMethodNotAllowed;
