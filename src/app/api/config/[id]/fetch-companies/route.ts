import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TallyDataFetcher } from '@/lib/tally-fetcher';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const baseConfig = await prisma.tallyConfiguration.findUnique({ where: { id } });

    if (!baseConfig) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    if (!baseConfig.isRemote || !baseConfig.gatewayId) {
      return NextResponse.json({ error: 'This configuration is not a remote gateway' }, { status: 400 });
    }

    const fetcher = new TallyDataFetcher(baseConfig);
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

    if (companyNames.length === 0) {
      return NextResponse.json({ error: 'No companies found on remote Tally instance' }, { status: 404 });
    }

    const created: any[] = [];
    for (let i = 0; i < companyNames.length; i++) {
      const companyName = companyNames[i];
      const existing = await prisma.tallyConfiguration.findFirst({
        where: { companyName, gatewayId: baseConfig.gatewayId }
      });

      if (existing) {
        const updated = await prisma.tallyConfiguration.update({
          where: { id: existing.id },
          data: { isActive: i === 0, companyName }
        });
        created.push(updated);
      } else {
        const newConfig = await prisma.tallyConfiguration.create({
          data: {
            host: baseConfig.host,
            port: baseConfig.port,
            companyName,
            syncInterval: baseConfig.syncInterval,
            isActive: i === 0,
            isRemote: true,
            gatewayId: baseConfig.gatewayId,
            deviceSecretHash: baseConfig.deviceSecretHash
          }
        });
        created.push(newConfig);
      }
    }

    if (baseConfig.companyName === 'Remote Gateway') {
      await prisma.tallyConfiguration.delete({ where: { id: baseConfig.id } });
    }

    return NextResponse.json({ configs: created, companies: companyNames });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
