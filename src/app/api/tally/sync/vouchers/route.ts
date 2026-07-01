import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SyncEngine } from '@/lib/sync-engine';

export async function POST(request: NextRequest) {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return NextResponse.json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' }, { status: 400 });
    const { fromDate, toDate } = await request.json();
    new SyncEngine(config).performVoucherSync(config.id, fromDate, toDate).catch(console.error);
    return NextResponse.json({ message: 'Voucher sync started', configId: config.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
