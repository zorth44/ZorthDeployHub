import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDbPath(databaseUrl: string) {
  const relative = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(relative)) {
    return relative;
  }
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), relative);
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const dbPath = resolveDbPath(url);
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
