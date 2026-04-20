import { stackProxies } from "./shared/proxies/stackProxies";
import { withLogging } from "./shared/proxies/withLogging";
import { withCors } from "./shared/proxies/withCors";
import { withAuth } from "./shared/proxies/withAuth";

/**
 * Global Proxy Stack
 * Note: [withNotFound] removed because [src/app/api/[...catch]] handles 
 * the 404/Method errors more reliably at the route level in Next.js.
 */
const proxies = [withLogging, withCors, withAuth];

export default stackProxies(proxies);

export const config = {
  matcher: [
    // Ensure all API calls are passed through the proxy stack
    "/api/:path*",
    // Exclude static Next.js internal files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
