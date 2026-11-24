# Build stage: install everything, build the site + server bundle
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY . .
RUN npm run build

# Run stage: the server is bundled by esbuild, so only dist/ is needed
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/boot.js"]
