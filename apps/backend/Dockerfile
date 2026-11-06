FROM oven/bun:1.4.4
WORKDIR /app
COPY . .
RUN bun install
WORKDIR /app/apps/backend
RUN bunx prisma generate
CMD ["sh", "-c", "bunx prisma migrate deploy && bun index.ts"]