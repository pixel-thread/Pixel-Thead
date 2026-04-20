import { NextResponse, NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AuthService } from "@/features/auth/services/auth.service";
import { handleError } from "@/shared/lib/errorHandler";
import { withValidation } from "@/lib/validation/withValidation";
import { ApiResponse } from "@/shared/utils/response.util";

export const POST = withValidation({}, async () => {
  const { userId } = await auth();

  if (!userId) {
    return handleError({ message: "Unauthorized", status: 401 });
  }

  const response = await AuthService.refreshToken(userId);

  return NextResponse.json(ApiResponse.success(response), { status: 200 });
});
