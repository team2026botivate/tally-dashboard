import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TallyDataFetcher } from '@/lib/tally-fetcher';

export async function GET() {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return NextResponse.json({ connected: false, host: null, port: null, error: 'No active Tally configuration found. Please configure Tally in Settings first.' }, { status: 404 });
    const fetcher = new TallyDataFetcher(config);
    await fetcher.fetchReport('CompanyInfo');
    return NextResponse.json({ connected: true, host: config.host, port: config.port });
  } catch (error: any) {
    return NextResponse.json({ connected: false, host: null, port: null, error: error.message }, { status: 503 });
  }
}
