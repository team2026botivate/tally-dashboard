import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    await prisma.tallyConfiguration.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    const config = await prisma.tallyConfiguration.update({
      where: { id },
      data: { isActive: true }
    });

    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
