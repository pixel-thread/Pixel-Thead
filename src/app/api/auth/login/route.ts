import { NextResponse } from "next/server";
import { withValidation } from "@/lib/validation/withValidation";
import { loginSchema } from "@/features/auth/validators/login.schema";
import { ApiResponse } from "@/shared/utils/response.util";

/**
 * Handle Login via Clerk (Headless/Server-side)
 * Note: Real-world password verification should ideally happen via Clerk SDK in Next.js
 */
export const POST = withValidation(
  {
    body: loginSchema,
  },
  async ({ body }) => {
    // In a real headless implementation, you would use Clerk's createSignIn
    // For this boilerplate, we acknowledge the credentials
    return NextResponse.json(
      ApiResponse.success({
        message:
          "Credentials accepted. Please complete sign-in via Clerk client.",
        email: body!.email,
      })
    );
  }
);
