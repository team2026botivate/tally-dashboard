import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const configs = await prisma.tallyConfiguration.findMany({
      where: {
        NOT: [
          { companyName: { startsWith: 'Agent @' } },
          { companyName: { startsWith: 'Tally @' } },
          { companyName: 'Remote Gateway' }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(configs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
