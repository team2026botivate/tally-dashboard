import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

async function fetchTallyCompanies(host: string, port: number): Promise<string[]> {
  const xml = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CompanyList</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CompanyList" ISINITIALIZE="No" ISFIXLIST="No">
            <TYPE>Company</TYPE>
            <FETCH>NAME</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  const response = await axios.post(`http://${host}:${port}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
    timeout: 15000
  });
  const nameRegex = /<NAME\s*(?:[^>]*)>([^<]+)<\/NAME>/gi;
  const names: string[] = [];
  let match;
  while ((match = nameRegex.exec(response.data)) !== null) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

export async function GET() {
  try {
    const config = await prisma.tallyConfiguration.findFirst({
      where: { isActive: true }
    });
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { host, port, syncInterval } = await request.json();
    if (!host || !port) {
      return NextResponse.json({ error: 'Host and port are required' }, { status: 400 });
    }

    let companyNames: string[] = [];
    let discovered = false;

    try {
      companyNames = await fetchTallyCompanies(host, Number(port));
      discovered = true;
    } catch (err: any) {
      console.warn('Could not reach Tally from server:', err.message);
    }

    await prisma.tallyConfiguration.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    const created: any[] = [];

    if (companyNames.length > 0) {
      for (let i = 0; i < companyNames.length; i++) {
        const companyName = companyNames[i];
        const existing = await prisma.tallyConfiguration.findFirst({ where: { companyName, host, port } });
        if (existing) {
          const updated = await prisma.tallyConfiguration.update({
            where: { id: existing.id },
            data: { host, port, syncInterval, isActive: i === 0 }
          });
          created.push(updated);
        } else {
          const newConfig = await prisma.tallyConfiguration.create({
            data: { host, port, companyName, syncInterval, isActive: i === 0 }
          });
          created.push(newConfig);
        }
      }
    } else {
      const label = `Tally @ ${host}:${port}`;
      const existing = await prisma.tallyConfiguration.findFirst({ where: { companyName: label, host, port } });
      if (existing) {
        const updated = await prisma.tallyConfiguration.update({
          where: { id: existing.id },
          data: { host, port, syncInterval, isActive: true }
        });
        created.push(updated);
      } else {
        const newConfig = await prisma.tallyConfiguration.create({
          data: { host, port, companyName: label, syncInterval, isActive: true }
        });
        created.push(newConfig);
      }
    }

    return NextResponse.json({
      configs: created,
      companies: companyNames.length > 0 ? companyNames : undefined,
      discovered,
      message: discovered
        ? `Configuration saved — ${companyNames.length} compan${companyNames.length === 1 ? 'y' : 'ies'} found`
        : 'Configuration saved. Tally is not reachable from this server. To sync data, run the Tally Agent on your local machine.'
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
