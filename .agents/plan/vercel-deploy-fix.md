# Plan: Fix Vercel Deployment Crash

This plan addresses the "Serverless Function Crashed" error by configuring the Hono app to properly interface with Vercel's Node.js runtime and setting up the necessary routing.

## Objective
Enable successful Vercel deployment by providing the correct serverless handlers and routing configuration.

## Key Files & Context
- `src/index.ts`: The main entry point that currently only exports the Hono app.
- `vercel.json`: Currently empty; needs routing rules.
- `src/shared/config/env.ts`: Strict environment variable validation that might cause crashes if variables are missing.

## Implementation Steps

### 1. Update `src/index.ts`
Modify `src/index.ts` to export the Vercel handler for all standard HTTP methods. This allows Vercel's Node.js runtime to process incoming requests through the Hono app.

### 2. Configure `vercel.json`
Create a `vercel.json` file to:
- Route all incoming requests (including the root and `/api/*`) to the entry point.
- Ensure the build output is correctly recognized.
- (Optional) Set `NODEJS_HELPERS: 0` if body parsing issues persist, though `hono/vercel` typically handles this.

### 3. Verify Environment Variables
Confirm with the user that all required environment variables defined in `src/shared/config/env.ts` (e.g., `DATABASE_URL`, `CLERK_SECRET_KEY`, `RAZORPAY_KEY_ID`, etc.) are set in the Vercel Dashboard. The app is configured to crash on startup if any are missing.

### 4. Deploy to Vercel
Run `vercel deploy --prod` to apply the changes.

## Verification
- Test the health check endpoint: `/api/health`
- Test the root endpoint: `/`
- Check Vercel logs for any runtime errors related to environment variables or module resolution.
