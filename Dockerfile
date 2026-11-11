FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 SETTLEMENT_MODE=mainnet SERVICE_DATABASE_PATH=/app/.data/econia-services.sqlite
RUN apk add --no-cache su-exec
COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/api apps/api
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/packages packages
COPY --from=build /app/scripts scripts
COPY --from=build /app/docs/agent-roster.json docs/agent-roster.json
COPY docker-entrypoint.sh /usr/local/bin/econia-entrypoint
RUN mkdir -p /app/.data && chown node:node /app/.data
RUN chmod +x /usr/local/bin/econia-entrypoint
EXPOSE 3001
ENTRYPOINT ["econia-entrypoint"]
CMD ["node", "scripts/start-mainnet.mjs"]
