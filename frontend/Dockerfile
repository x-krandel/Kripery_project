# Production image: Vite build + server.js (static files, SPA fallback, /env.js).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_USE_MOCKS=false
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/dist ./dist
COPY server.js package.json ./
EXPOSE 8080
CMD ["node", "server.js"]
