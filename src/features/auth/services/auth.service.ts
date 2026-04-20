import { createClerkClient } from "@clerk/backend";
import { env } from "@config/env";
import { LoginCredentials, SignupData } from "../validators/login.schema";
import { ApiResponse } from "@utils/response.util";

// Initialize the Clerk client using your environment secret
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export class AuthService {
  /**
   * Find a user by email via Clerk
   */
  static async loginWithCredentials(credentials: LoginCredentials) {
    try {
      const users = await clerk.users.getUserList({
        emailAddress: [credentials.email],
      });

      const user = users.data[0];

      if (!user) {
        return ApiResponse.error("Invalid credentials", 401);
      }

      return ApiResponse.success({
        message: "User identified.",
        userId: user.id,
      });
    } catch (error: any) {
      return ApiResponse.error(error.message || "Authentication failed", 500);
    }
  }

  /**
   * Create a new user in Clerk
   */
  static async signup(data: SignupData) {
    try {
      const user = await clerk.users.createUser({
        emailAddress: [data.email],
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });

      return ApiResponse.success({
        message: "User created successfully.",
        userId: user.id,
      }, 201);
    } catch (error: any) {
      return ApiResponse.error(error.message || "Signup failed", 400);
    }
  }

  /**
   * Initial trigger for password reset flow
   */
  static async initiatePasswordReset(email: string) {
    try {
      const users = await clerk.users.getUserList({
        emailAddress: [email],
      });

      const user = users.data[0];

      if (!user) {
        // Obfuscate for security: return success even if user not found
        return ApiResponse.success({ message: "Reset instructions sent if account exists." });
      }

      // Note: Full headless password reset requires specialized Clerk settings
      return ApiResponse.success({
        message: "Reset initiated for user.",
        userId: user.id,
      });
    } catch (error: any) {
      return ApiResponse.error(error.message || "Failed to initiate reset", 500);
    }
  }
}
