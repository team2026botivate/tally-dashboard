import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const limit = searchParams.get('limit');
    const items = await prisma.stockItem.findMany({
      where: { companyId },
      select: {
        id: true, name: true, unit: true, openingQty: true, closingQty: true,
        closingValue: true, rate: true, gstRate: true, hsnCode: true,
        stockGroup: { select: { name: true } }
      },
      orderBy: { name: 'asc' },
      take: limit ? parseInt(limit) : 200
    });
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
