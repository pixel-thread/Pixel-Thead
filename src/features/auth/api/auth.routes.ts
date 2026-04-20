import { Hono } from "hono";
import { authMiddleware } from "@features/auth/middleware/clerk.middleware";
import { ApiResponse } from "@utils/response.util";
import { HonoVariables } from "@/shared/types/hono.types";
import { zValidator } from "@hono/zod-validator";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
} from "../validators/login.schema";
import { AuthService } from "../services/auth.service";

const authRoutes = new Hono<{ Variables: HonoVariables }>();

// GET /auth/me — Returns authenticated user info
authRoutes.get("/me", authMiddleware, (c) => {
  const user = c.get("user");
  return c.json(ApiResponse.success(user));
});

// POST /auth/credentials — Login with email and password
authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const data = c.req.valid("json");
  const result = await AuthService.loginWithCredentials(data);
  return c.json(result, (result as any).status || 200);
});

// POST /auth/signup — Register a new user
authRoutes.post("/signup", zValidator("json", signupSchema), async (c) => {
  const data = c.req.valid("json");
  const result = await AuthService.signup(data);
  return c.json(result, (result as any).status || 200);
});

// POST /auth/forgot-password — Trigger password reset
authRoutes.post(
  "/forgot-password",
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid("json");
    const result = await AuthService.initiatePasswordReset(email);
    return c.json(result, (result as any).status || 200);
  },
);

// POST /auth/refresh — Refresh token placeholder
authRoutes.post("/refresh", (c) => {
  return c.json(
    ApiResponse.success({
      message: "Clerk handles refresh tokens automatically.",
    }),
  );
});

export default authRoutes;
