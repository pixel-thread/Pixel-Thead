import { defineConfig, env } from "prisma/config";
import "dotenv/config";

/**
 * Official Prisma 6+ Configuration
 * This file provides type-safe configuration for the Prisma CLI and Client.
 * @see https://www.prisma.io/docs/orm/reference/prisma-config-reference
 */
export default defineConfig({
  // Point to your schema file location
  schema: "prisma/schema.prisma",

  // Configure database connection using the type-safe env helper
  datasource: {
    url: env("DATABASE_URL"),
  },

  // Migration and Seeding configuration
  migrations: {
    path: "prisma/migrations",
  },
});
