import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { label, syncInterval } = await request.json();

    const gatewayId = 'gw_' + crypto.randomBytes(8).toString('hex');
    const deviceSecret = crypto.randomBytes(20).toString('hex');
    const deviceSecretHash = await hashPassword(deviceSecret);

    const config = await prisma.tallyConfiguration.create({
      data: {
        host: 'localhost',
        port: 9000,
        companyName: label || 'Remote Gateway',
        syncInterval: syncInterval ? Number(syncInterval) : 300000,
        isActive: false,
        isRemote: true,
        gatewayId,
        deviceSecretHash,
        status: 'OFFLINE'
      }
    });

    return NextResponse.json({
      config,
      credentials: { gatewayId, deviceSecret }
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
