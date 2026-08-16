import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { sharnamPrisma?: PrismaClient };

function buildClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.sharnamPrisma) {
    globalForPrisma.sharnamPrisma = buildClient();
  }
  return globalForPrisma.sharnamPrisma;
}

/** Proxy so all modules share one client even after reset. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(client) : val;
  },
});

export async function ensureDbConnected() {
  await getPrisma().$connect();
}

export function isPrismaFatal(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = String((err as { name?: string }).name || "");
  const msg = String((err as { message?: string }).message || "");
  return (
    name.includes("PrismaClient") ||
    msg.includes("PANIC:") ||
    msg.includes("timer has gone away")
  );
}

export async function resetPrismaClient() {
  if (globalForPrisma.sharnamPrisma) {
    try {
      await globalForPrisma.sharnamPrisma.$disconnect();
    } catch {
      /* ignore */
    }
  }
  globalForPrisma.sharnamPrisma = buildClient();
  await globalForPrisma.sharnamPrisma.$connect();
}
