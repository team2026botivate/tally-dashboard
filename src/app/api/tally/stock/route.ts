import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const items = await prisma.stockItem.findMany({
      select: {
        id: true, name: true, unit: true, openingQty: true, closingQty: true,
        closingValue: true, rate: true, gstRate: true, hsnCode: true,
        stockGroup: { select: { name: true } }
      },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
