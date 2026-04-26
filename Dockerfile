# 国内网络环境建议使用镜像仓库前缀（默认：DaoCloud DockerHub Mirror）
ARG IMAGE_REGISTRY=docker.m.daocloud.io

FROM ${IMAGE_REGISTRY}/library/node:20-alpine AS build

WORKDIR /app

# Use China-friendly npm mirror
RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Increase Node heap for Vite/TS build (avoid OOM on large bundles)
ENV NODE_OPTIONS=--max-old-space-size=4096

# Vite envs are baked at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN npm run build


FROM ${IMAGE_REGISTRY}/library/node:20-alpine

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start"]
