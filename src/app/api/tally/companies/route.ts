import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TallyDataFetcher } from '@/lib/tally-fetcher';

export async function GET() {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return NextResponse.json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' }, { status: 404 });

    const fetcher = new TallyDataFetcher(config);
    const parsed = await fetcher.fetchReport('CompanyInfo');

    const companiesList = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.[0]?.COMPANY || [];
    const companyNames: string[] = companiesList.map((c: any) =>
      typeof c.NAME === 'object' ? c.NAME['#text'] : c.NAME
    ).filter(Boolean);

    const companies = [...new Set(companyNames)].map((name, i) => ({
      id: `tally-${i}`,
      companyName: name
    }));

    return NextResponse.json(companies);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
