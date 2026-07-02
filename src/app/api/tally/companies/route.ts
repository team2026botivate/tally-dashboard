import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TallyDataFetcher } from '@/lib/tally-fetcher';

export async function GET() {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return NextResponse.json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' }, { status: 404 });

    const fetcher = new TallyDataFetcher(config);
    const parsed = await fetcher.fetchReport('CompanyInfo');

    const envelope = parsed?.ENVELOPE;
    const dataColl = envelope?.BODY?.DATA?.COLLECTION;
    const arr = dataColl ? (Array.isArray(dataColl) ? dataColl : [dataColl]) : [];
    
    let companiesList: any[] = [];
    for (const c of arr) {
      const items = c.COMPANY || c.Company || c.company;
      if (items) {
        companiesList = Array.isArray(items) ? items : [items];
        break;
      }
    }

    const companyNames: string[] = companiesList.map((c: any) => {
      const nameVal = c.NAME || c.Name || c.name;
      if (nameVal != null) {
        return typeof nameVal === 'object' ? (nameVal['#text'] ?? '') : String(nameVal);
      }
      return '';
    }).filter(Boolean);

    const companies = [...new Set(companyNames)].map((name, i) => ({
      id: `tally-${i}`,
      companyName: name
    }));

    return NextResponse.json(companies);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
