import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const gatewayId = request.headers.get('x-gateway-id');
    const deviceSecret = request.headers.get('x-device-secret');
    if (!gatewayId || !deviceSecret) {
      return NextResponse.json({ error: 'Missing gateway credentials' }, { status: 401 });
    }

    const config = await prisma.tallyConfiguration.findUnique({ where: { gatewayId } });
    if (!config || !config.deviceSecretHash) {
      return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
    }

    const valid = await comparePassword(deviceSecret, config.deviceSecretHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid device secret' }, { status: 401 });
    }

    await prisma.tallyConfiguration.update({
      where: { id: config.id },
      data: {
        lastHeartbeatAt: new Date(),
        status: 'ONLINE',
        deviceInfo: request.headers.get('x-device-info')
          ? JSON.parse(request.headers.get('x-device-info')!)
          : undefined,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Heartbeat failed' }, { status: 500 });
  }
}
