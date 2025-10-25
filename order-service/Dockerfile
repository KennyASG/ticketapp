# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:16-alpine AS dependencies

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# ============================================
# Stage 2: Production
# ============================================
FROM node:16-alpine

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /usr/src/app

COPY --from=dependencies --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]