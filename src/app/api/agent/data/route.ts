import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DataTransformer } from '@/lib/data-transformer';
import { comparePassword } from '@/lib/auth';

async function authenticate(request: NextRequest): Promise<{ gatewayId: string } | null> {
  const gatewayId = request.headers.get('x-gateway-id');
  const deviceSecret = request.headers.get('x-device-secret');
  if (!gatewayId || !deviceSecret) return null;

  const config = await prisma.tallyConfiguration.findUnique({ where: { gatewayId } });
  if (!config || !config.deviceSecretHash) return null;

  const valid = await comparePassword(deviceSecret, config.deviceSecretHash);
  return valid ? { gatewayId } : null;
}

async function getOrCreateCompany(gatewayId: string, companyName: string, host: string, port: number) {
  const existing = await prisma.tallyConfiguration.findFirst({
    where: { companyName, gatewayId }
  });

  if (existing) return existing;

  return prisma.tallyConfiguration.create({
    data: {
      host,
      port,
      companyName,
      isRemote: true,
      gatewayId,
      isActive: false,
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing gateway credentials' }, { status: 401 });
    }

    const { companyName, host, port, ledgers, stockGroups, stockItems, vouchers } = await request.json();

    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }

    const company = await getOrCreateCompany(auth.gatewayId, companyName, host || 'localhost', port || 9000);
    const companyId = company.id;
    const transformer = new DataTransformer();
    let total = 0;

    if (ledgers && Array.isArray(ledgers)) {
      const count = await transformer.transformAndSaveLedgers({ groups: ledgers }, companyId);
      total += count;
      console.log(`Agent synced ${count} ledgers for ${companyName}`);
    }

    if (stockGroups && Array.isArray(stockGroups)) {
      const count = await transformer.transformAndSaveStockGroups({ groups: stockGroups }, companyId);
      total += count;
      console.log(`Agent synced ${count} stock groups for ${companyName}`);
    }

    if (stockItems && Array.isArray(stockItems)) {
      const rawItems = { groupName: 'Primary', items: stockItems };
      const count = await transformer.transformAndSaveStockItems(rawItems, companyId);
      total += count;
      console.log(`Agent synced ${count} stock items for ${companyName}`);
    }

    if (vouchers && Array.isArray(vouchers)) {
      const count = await transformer.transformAndSaveVouchers({ vouchers }, companyId);
      total += count;
      console.log(`Agent synced ${count} vouchers for ${companyName}`);
    }

    await prisma.tallyConfiguration.update({
      where: { id: companyId },
      data: { lastSyncAt: new Date(), status: 'ONLINE' }
    });

    return NextResponse.json({
      success: true,
      companyName,
      recordsSaved: total
    });
  } catch (error: any) {
    console.error('Agent data sync error:', error);
    return NextResponse.json({ error: error?.message || 'Sync failed' }, { status: 500 });
  }
}
