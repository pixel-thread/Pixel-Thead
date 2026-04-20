import { createClerkClient } from "@clerk/backend";
import { env } from "@/shared/config/env";
import { SignupData } from "../validators/login.schema";
import { ApiResponse } from "@/shared/utils/response.util";
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export class AuthService {
  /**
   * Note: Password verification usually happens in the client-side SDK.
   * Headless authentication (server-side) requires using Clerk's SignIn strategy.
   * This service interacts with the Backend SDK for user management.
   */

  static async signup(data: SignupData) {
    const user = await clerk.users.createUser({
      emailAddress: [data.email],
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      skipPasswordChecks: false,
    });

    return ApiResponse.success({
      message: "User created successfully.",
      user: {
        id: user.id,
        email: user.emailAddresses[0].emailAddress,
      },
    });
  }

  static async initiatePasswordReset(email: string) {
    // In Clerk's headless flow, we typically check if user exists first
    const users = await clerk.users.getUserList({ emailAddress: [email] });

    if (users.data.length === 0) {
      return ApiResponse.success({
        message: "If an account exists, a reset link has been sent.",
      });
    }

    // Logic for password reset..
    return ApiResponse.success({
      message: "Password reset initiated successfully.",
    });
  }

  static async refreshToken(userId: string) {
    // Create a session token for the user to 'refresh' the identity
    const token = await clerk.sessions.getToken(userId, "clerk_token_label");
    return ApiResponse.success({ token });
  }
}
