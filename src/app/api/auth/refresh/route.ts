import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AuthService } from "@/features/auth/services/auth.service";
import { withErrorHandler } from "@/shared/lib/errorHandler";
import { ApiResponse } from "@/shared/utils/response.util";
import { UnauthorizedError } from "@/shared/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/refresh
 * Re-issues a fresh JWT for the currently authenticated user.
 */
export const POST = withErrorHandler(async () => {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError("Session expired. Identity could not be verified.");
  }

  const { token } = await AuthService.refreshToken(userId);

  return NextResponse.json(ApiResponse.success({ token }));
});
