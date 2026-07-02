import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const [ledgers, ledgerCount, voucherCount] = await Promise.all([
      prisma.ledger.findMany({
        where: { companyId },
        select: {
          groupName: true,
          parentGroup: true,
          currentBalance: true
        }
      }),
      prisma.ledger.count({ where: { companyId } }),
      prisma.voucher.count({ where: { companyId, isCancelled: false } }),
    ]);

    let assets = 0;
    let liabilities = 0;

    ledgers.forEach(l => {
      const g = (l.groupName || '').toLowerCase();
      const p = (l.parentGroup || '').toLowerCase();
      const balance = parseFloat(l.currentBalance as any) || 0;

      // Expenses/Income groups
      const expenseGroups = ['purchase accounts', 'direct expenses', 'indirect expenses', 'expense', 'expenses', 'cost of sales'];
      const incomeGroups = ['sales accounts', 'direct incomes', 'indirect incomes', 'income', 'incomes', 'revenue'];

      if (expenseGroups.some(term => g.includes(term) || p.includes(term)) || incomeGroups.some(term => g.includes(term) || p.includes(term))) {
        return;
      }

      const assetGroups = ['asset', 'assets', 'fixed assets', 'investments', 'current assets', 'bank accounts', 'cash-in-hand', 'sundry debtors', 'loans & advances (asset)', 'deposits (asset)'];
      const liabilityGroups = ['liability', 'liabilities', 'capital account', 'loans (liability)', 'sundry creditors', 'duties & taxes', 'provisions', 'bank od a/c', 'reserves & surplus', 'branch / divisions'];

      if (assetGroups.some(term => g.includes(term) || p.includes(term))) {
        assets += Math.abs(balance);
      } else if (liabilityGroups.some(term => g.includes(term) || p.includes(term))) {
        liabilities += Math.abs(balance);
      } else {
        if (balance >= 0) {
          assets += balance;
        } else {
          liabilities += Math.abs(balance);
        }
      }
    });

    return NextResponse.json({
      assets,
      liabilities,
      ledgerCount,
      voucherCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
