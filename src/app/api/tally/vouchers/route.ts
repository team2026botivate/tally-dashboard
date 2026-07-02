import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const type = searchParams.get('type');
    const limit = searchParams.get('limit');

    const where: any = { companyId, isCancelled: false };
    if (from) where.voucherDate = { ...where.voucherDate, gte: new Date(from) };
    if (to) where.voucherDate = { ...where.voucherDate, lte: new Date(to) };
    if (type) where.voucherType = { name: type };

    const vouchers = await prisma.voucher.findMany({
      where,
      select: {
        id: true, tallyId: true, voucherNumber: true, voucherDate: true,
        narration: true, totalAmount: true, isCancelled: true,
        voucherType: { select: { name: true } },
        entries: {
          select: { id: true, amount: true, entryType: true, ledger: { select: { name: true } } }
        }
      },
      orderBy: { voucherDate: 'desc' },
      take: limit ? parseInt(limit) : 100
    });
    return NextResponse.json(vouchers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
