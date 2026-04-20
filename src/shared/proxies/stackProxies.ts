import { NextMiddleware, NextResponse } from "next/server";

export type ProxyFactory = (proxy: NextMiddleware) => NextMiddleware;

export function stackProxies(
  functions: ProxyFactory[] = [],
  index = 0
): NextMiddleware {
  const current = functions[index];

  if (current) {
    const next = stackProxies(functions, index + 1);
    return current(next);
  }

  return () => NextResponse.next();
}
