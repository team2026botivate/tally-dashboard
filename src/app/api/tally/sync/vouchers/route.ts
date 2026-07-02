import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SyncEngine } from '@/lib/sync-engine';

export async function POST(request: NextRequest) {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return NextResponse.json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' }, { status: 400 });
    const { fromDate, toDate } = await request.json();
    const recordsProcessed = await new SyncEngine(config).performVoucherSync(config.id, fromDate ? new Date(fromDate) : undefined, toDate ? new Date(toDate) : undefined);
    return NextResponse.json({ message: 'Voucher sync completed successfully', configId: config.id, recordsProcessed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
