FROM node:22-alpine AS protector
WORKDIR /build
COPY backend/package*.json ./
RUN npm ci
COPY backend/src ./src
COPY backend/scripts ./scripts
RUN npm run protect

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PROTECTED_RUNTIME=1
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=protector /build/dist-protected ./src
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
