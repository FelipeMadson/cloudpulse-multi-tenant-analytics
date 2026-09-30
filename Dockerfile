FROM node:22-alpine AS runtime
WORKDIR /app
COPY backend/package*.json ./
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/public ./public
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
CMD ["node", "--experimental-strip-types", "src/server.ts"]
