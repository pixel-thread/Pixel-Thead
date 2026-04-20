import { stackProxies } from "./shared/proxies/stackProxies";
import { withLogging } from "./shared/proxies/withLogging";
import { withCors } from "./shared/proxies/withCors";
import { withAuth } from "./shared/proxies/withAuth";

const proxies = [withLogging, withCors, withAuth];

export default stackProxies(proxies);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|musl)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
