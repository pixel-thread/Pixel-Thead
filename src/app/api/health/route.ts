import { NextResponse } from "next/server";
import { handleMethodNotAllowed } from "@/shared/lib/errorHandler";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "pixel-thread",
  });
}

// Spread the shared handlers (POST, PUT, PATCH, DELETE)
export const { POST, PUT, PATCH, DELETE } = handleMethodNotAllowed;
