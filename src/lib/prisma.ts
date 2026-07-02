import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const poolUrl = process.env.DATABASE_URL?.includes('?')
  ? `${process.env.DATABASE_URL}&connection_limit=20&pool_timeout=30`
  : `${process.env.DATABASE_URL}?connection_limit=20&pool_timeout=30`;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
  datasources: process.env.NODE_ENV === 'production' ? {
    db: { url: poolUrl }
  } : undefined,
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
