import { Hono } from "hono";
import { Prisma } from "@db/generated";
import { HonoVariables } from "@/shared/types/hono.types";

export function registerErrorHandlers(app: Hono<{ Variables: HonoVariables }>) {
  app.notFound((c) =>
    c.json({ success: false, error: "Route not found." }, 404),
  );

  app.onError((err, c) => {
    // Handle known Prisma request errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return c.json(
          {
            success: false,
            error: "Duplicate record — this entry already exists.",
          },
          409,
        );
      }
      if (err.code === "P2025") {
        return c.json({ success: false, error: "Record not found." }, 404);
      }
    }

    // Handle Prisma initialization errors (DB connection failures)
    if (err instanceof Prisma.PrismaClientInitializationError) {
      console.error("Database connection failed:", err.message);
      return c.json(
        {
          success: false,
          error: "Database unavailable. Please try again later.",
        },
        503,
      );
    }

    // Catch-all for unhandled errors
    console.error("Unhandled error:", err);
    return c.json({ success: false, error: "Internal server error." }, 500);
  });
}
