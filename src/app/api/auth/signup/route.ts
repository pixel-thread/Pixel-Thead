import { NextResponse } from "next/server";
import { withValidation } from "@/lib/validation/withValidation";
import { signupSchema } from "@/features/auth/validators/login.schema";
import { AuthService } from "@/features/auth/services/auth.service";

export const POST = withValidation({ body: signupSchema }, async ({ body }) => {
  const response = await AuthService.signup(body!);
  return NextResponse.json(response, { status: 200 });
});
