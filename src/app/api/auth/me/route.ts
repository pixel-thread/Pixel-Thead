import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { AuthService } from "@/features/auth/services/auth.service";
import { withErrorHandler } from "@/shared/lib/errorHandler";
import { ApiResponse } from "@/shared/utils/response.util";
import { UnauthorizedError } from "@/shared/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 * Retrieves the currently authenticated user's profile.
 */
export const GET = withErrorHandler(async () => {
  const { userId } = await auth();

  if (!userId) throw new UnauthorizedError("Session expired or invalid.");

  const profile = await AuthService.getCurrentUser(userId);

  return NextResponse.json(ApiResponse.success(profile));
});
