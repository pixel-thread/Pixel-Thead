import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(2, "First name is too short").optional(),
  lastName: z.string().min(2, "Last name is too short").optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyPasswordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(6, "Invalid verification code"),
  newPassword: z.string().min(8, "Password too short"),
});

export type LoginCredentials = z.infer<typeof loginSchema>;
export type SignupData = z.infer<typeof signupSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type VerifyPasswordResetData = z.infer<typeof verifyPasswordResetSchema>;
