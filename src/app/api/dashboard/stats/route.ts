import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const [assetResult, liabilityResult, ledgerCount, voucherCount] = await Promise.all([
      prisma.$queryRaw<Array<{ balance: bigint }>>`
        SELECT COALESCE(SUM("currentBalance"), 0) as balance
        FROM "Ledger"
        WHERE "companyId" = ${companyId}
          AND "parentGroup" IN (
            'Current Assets', 'Fixed Assets', 'Investments', 'Bank Accounts',
            'Cash-in-hand', 'Cash-in-Hand', 'Sundry Debtors', 'Loans & Advances (Asset)',
            'Deposits (Asset)', 'Misc. Expenses (ASSET)', 'Suspense A/c'
          )
      `,
      prisma.$queryRaw<Array<{ balance: bigint }>>`
        SELECT COALESCE(SUM("currentBalance"), 0) as balance
        FROM "Ledger"
        WHERE "companyId" = ${companyId}
          AND "parentGroup" IN (
            'Current Liabilities', 'Capital Account', 'Loans (Liability)', 'Sundry Creditors',
            'Duties & Taxes', 'Provisions', 'Bank OD A/c', 'Bank OCC A/c',
            'Secured Loans', 'Unsecured Loans', 'Reserves & Surplus', 'Branch / Divisions'
          )
      `,
      prisma.ledger.count({ where: { companyId } }),
      prisma.voucher.count({ where: { companyId, isCancelled: false } }),
    ]);

    return NextResponse.json({
      assets: Number(assetResult[0]?.balance || 0),
      liabilities: Number(liabilityResult[0]?.balance || 0),
      ledgerCount,
      voucherCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
