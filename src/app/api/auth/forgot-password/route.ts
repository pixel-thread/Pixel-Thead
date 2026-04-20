import { NextResponse } from "next/server";
import { withValidation } from "@/lib/validation/withValidation";
import { forgotPasswordSchema } from "@/features/auth/validators/login.schema";
import { AuthService } from "@/features/auth/services/auth.service";

export const POST = withValidation(
  { body: forgotPasswordSchema },
  async ({ body }) => {
    const response = await AuthService.initiatePasswordReset(body.email);
    return NextResponse.json(response);
  }
);
