#!/bin/bash

# Color output for better visibility in logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

set -e

echo -e "${YELLOW}🚀 Starting deployment pipeline...${NC}"

echo -e "${YELLOW}📦 Installing fresh dependencies...${NC}"
pnpm install

echo -e "${YELLOW}🏗️ Building standalone production bundle into /dist...${NC}"
# This runs db:generate, esbuild bundling, and file sync (package.json/prisma)
vercel build -- prod

echo -e "${YELLOW}⬆️ Deploying to Vercel from /dist folder...${NC}"
# We deploy the 'dist' directory directly as a production release
vercel deploy --prebuilt --prod --yes --logs

echo -e "${GREEN}✅ Deployment complete! Your Hono service is live.${NC}"
