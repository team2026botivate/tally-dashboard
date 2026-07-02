const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const configs = await prisma.tallyConfiguration.findMany();
  console.log('Configs:', configs);
  const ledgers = await prisma.ledger.count();
  console.log('Ledgers:', ledgers);
  const vouchers = await prisma.voucher.count();
  console.log('Vouchers:', vouchers);
  const stockItems = await prisma.stockItem.count();
  console.log('StockItems:', stockItems);
}
main().catch(console.error).finally(() => prisma.$disconnect());
