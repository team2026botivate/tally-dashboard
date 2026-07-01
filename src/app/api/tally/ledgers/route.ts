import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const ledgers = await prisma.ledger.findMany({
      select: {
        id: true, name: true, groupName: true, openingBalance: true,
        currentBalance: true, isActive: true, lastSyncAt: true
      },
      orderBy: { name: 'asc' },
      take: limit ? parseInt(limit) : undefined
    });
    return NextResponse.json(ledgers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
