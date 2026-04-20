import { createClerkClient } from "@clerk/backend";
import { env } from "@/shared/config/env";
import { NotFoundError, UnauthorizedError } from "@/shared/lib/errors";
import { ApiResponse } from "@/shared/utils/response.util";

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export class AuthService {
  /**
   * Retrieves current user data (Identity)
   */
  static async getCurrentUser(userId: string) {
    const user = await clerk.users.getUser(userId);

    if (!user) {
      throw new NotFoundError("User account not found.");
    }

    const data = {
      id: user.id,
      email: user.emailAddresses?.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      publicMetadata: user.publicMetadata,
      createdAt: user.createdAt,
    };

    return ApiResponse.success(data, "User Verified.");
  }

  /**
   * Refresh/Re-issue a session token
   */
  static async refreshToken(userId: string) {
    // 1. Check for active sessions to verify state
    const sessions = await clerk.sessions.getSessionList({
      userId,
      status: "active",
      limit: 1,
    });

    if (!sessions || sessions.data.length === 0) {
      throw new UnauthorizedError(
        "No active session found. Please log in again."
      );
    }

    // 2. Generate a fresh JWT for the client
    // This allows the client to update their local storage/cookie with a fresh token
    const token = await clerk.sessions.getToken(userId, "clerk-jwt-default");

    return { token };
  }
}
