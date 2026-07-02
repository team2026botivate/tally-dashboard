import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const configs = await prisma.tallyConfiguration.findMany();
    const ledgers = await prisma.ledger.count();
    const vouchers = await prisma.voucher.count();
    const stockItems = await prisma.stockItem.count();
    
    return NextResponse.json({
      configs,
      counts: {
        ledgers,
        vouchers,
        stockItems
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
