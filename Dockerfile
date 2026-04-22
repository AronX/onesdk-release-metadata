FROM node:20-alpine

RUN apk add --no-cache \
  ca-certificates \
  git \
  lsof \
  openssh-client \
  procps

WORKDIR /workspace/app/service

ENV NODE_ENV=production
ENV PORT=3210

COPY docker-entrypoint.sh /usr/local/bin/onesdk-metadata-entrypoint
COPY app/service/package*.json ./
COPY app/service/src ./src
COPY app/web /workspace/app/web
COPY mappings /workspace/mappings
COPY schemas /workspace/schemas

RUN chmod +x /usr/local/bin/onesdk-metadata-entrypoint

EXPOSE 3210

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3210) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["onesdk-metadata-entrypoint"]
CMD ["npm", "start"]
