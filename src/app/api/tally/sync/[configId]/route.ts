import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SyncEngine } from '@/lib/sync-engine';

export async function POST(request: NextRequest, { params }: { params: Promise<{ configId: string }> }) {
  try {
    const { configId } = await params;
    const config = await prisma.tallyConfiguration.findUnique({ where: { id: configId } });
    if (!config) return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    const result = await new SyncEngine(config).performFullSync(config.id);
    return NextResponse.json({ message: 'Full sync completed successfully', configId: config.id, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
