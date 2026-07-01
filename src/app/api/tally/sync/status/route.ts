import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const latestSync = await prisma.syncLog.findFirst({ orderBy: { startedAt: 'desc' } });
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    return NextResponse.json({
      lastSync: latestSync,
      lastSyncTime: config?.lastSyncAt,
      isConfigured: !!config
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
