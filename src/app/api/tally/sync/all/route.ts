import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SyncEngine } from '@/lib/sync-engine';

export async function POST() {
  try {
    const configs = await prisma.tallyConfiguration.findMany({
      where: { isRemote: false }
    });

    if (configs.length === 0) {
      return NextResponse.json(
        { error: 'No Tally configurations found. Please configure Tally in Settings first.' },
        { status: 400 }
      );
    }

    const firstConfig = configs[0];
    new SyncEngine(firstConfig).performFullSyncAll().catch(console.error);

    return NextResponse.json({
      message: `Sync started for ${configs.length} compan${configs.length === 1 ? 'y' : 'ies'}`,
      companiesCount: configs.length
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
