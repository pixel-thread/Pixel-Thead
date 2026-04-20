import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/shared/lib/errorHandler";

/* -------------------------------------------------- */
/* Types */
/* -------------------------------------------------- */

type InferOrUndefined<T extends z.ZodTypeAny | undefined> =
  T extends z.ZodTypeAny ? z.infer<T> : undefined;

type Schemas<
  P extends z.ZodTypeAny | undefined,
  Q extends z.ZodTypeAny | undefined,
  B extends z.ZodTypeAny | undefined,
> = {
  params?: P;
  query?: Q;
  body?: B;
};

/* -------------------------------------------------- */
/* Helpers */
/* -------------------------------------------------- */

async function safeJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------- */
/* Main wrapper */
/* -------------------------------------------------- */

export function withValidation<
  P extends z.ZodTypeAny | undefined = undefined,
  Q extends z.ZodTypeAny | undefined = undefined,
  B extends z.ZodTypeAny | undefined = undefined,
>(
  schemas: Schemas<P, Q, B>,
  handler: (
    data: {
      params: InferOrUndefined<P>;
      query: InferOrUndefined<Q>;
      body: InferOrUndefined<B>;
    },
    req: NextRequest
  ) => Promise<Response | NextResponse>
) {
  return async (
    req: NextRequest,
    segmentData: { params: Promise<Record<string, string | string[]>> }
  ): Promise<Response | NextResponse> => {
    try {
      /* ---------------- params ---------------- */
      const resolvedParams = await segmentData?.params;

      const validatedParams =
        schemas.params && resolvedParams
          ? schemas.params.parse(resolvedParams)
          : undefined;

      /* ---------------- query ---------------- */
      const { searchParams } = new URL(req.url);
      const queryObj = Object.fromEntries(searchParams.entries());

      const validatedQuery = schemas.query
        ? schemas.query.parse(queryObj)
        : undefined;

      /* ---------------- body ---------------- */
      let validatedBody: InferOrUndefined<B>;

      if (schemas.body) {
        const rawBody = await safeJson(req);
        validatedBody = schemas.body.parse(rawBody) as InferOrUndefined<B>;
      } else {
        validatedBody = undefined as InferOrUndefined<B>;
      }

      /* ---------------- handler ---------------- */
      return await handler(
        {
          params: validatedParams as InferOrUndefined<P>,
          query: validatedQuery as InferOrUndefined<Q>,
          body: validatedBody,
        },
        req
      );
    } catch (error: any) {
      return handleError(error);
    }
  };
}
