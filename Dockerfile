FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/api apps/api
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/packages packages
COPY --from=build /app/scripts scripts
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
EXPOSE 3001
CMD ["node", "apps/api/server.mjs"]
