# ---- deps: cài dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: build Next.js (standalone) ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# data/employees.json đã được import sẵn (chạy `npm run import` trước khi build)
RUN npm run build

# ---- runner: image chạy production gọn nhẹ ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs

# assets tĩnh (poster nền, glyph số, font, khung tên...) + bundle standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# thư mục data runtime (admin upload ghi vào) — nên mount volume vào đây
RUN mkdir -p /app/runtime-data && chown -R nextjs:nodejs /app/runtime-data
ENV DATA_PATH=/app/runtime-data/employees.json

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
