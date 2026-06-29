import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning up synced data...');
  await prisma.voucherEntry.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.stockGroup.deleteMany();
  await prisma.ledger.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.syncMetadata.deleteMany();
  console.log('Data cleaned up.');
}

clean().catch(console.error).finally(() => prisma.$disconnect());
