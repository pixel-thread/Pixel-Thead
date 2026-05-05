import { handleError } from "@/shared/lib/errorHandler";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const number: number = parseInt(searchParams.get("num") || "1") || 1;

    const body = await req.json();

    const data = Array.from({ length: number }, () => body);
    return NextResponse.json({
      data: data,
    });
  } catch (error) {
    return handleError(error);
  }
}
