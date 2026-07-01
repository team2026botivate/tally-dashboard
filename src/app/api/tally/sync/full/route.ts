import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SyncEngine } from '@/lib/sync-engine';

export async function POST() {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return NextResponse.json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' }, { status: 400 });
    new SyncEngine(config).performFullSync(config.id).catch(console.error);
    return NextResponse.json({ message: 'Full sync started successfully', configId: config.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
