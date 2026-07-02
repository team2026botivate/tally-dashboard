import { prisma } from './prisma';

export class DashboardService {
  async getBalanceSheet(companyId: string): Promise<any> {
    try {
      const ledgers = await prisma.ledger.findMany({
        where: { companyId },
        select: {
          groupName: true,
          parentGroup: true,
          currentBalance: true
        }
      });

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

      return [
        { category: 'Assets', balance: assets },
        { category: 'Liabilities', balance: liabilities }
      ];
    } catch (error) {
      console.error('Error fetching balance sheet:', error);
      return [];
    }
  }

  async getTrialBalance(companyId: string): Promise<any> {
    const ledgers = await prisma.ledger.findMany({
      where: { companyId },
      select: {
        name: true,
        groupName: true,
        parentGroup: true,
        openingBalance: true,
        currentBalance: true
      },
      orderBy: { name: 'asc' }
    });
    return ledgers;
  }

  async getVoucherTrends(companyId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const trends = await prisma.$queryRaw`
        SELECT
          DATE("voucherDate") as date,
          vt.name as voucher_type,
          COUNT(*) as count,
          SUM(v."totalAmount") as total_amount
        FROM "Voucher" v
        JOIN "VoucherType" vt ON v."voucherTypeId" = vt.id
        WHERE v."companyId" = ${companyId}
          AND v."voucherDate" >= ${startDate}
          AND v."isCancelled" = false
        GROUP BY DATE("voucherDate"), vt.name
        ORDER BY DATE("voucherDate") DESC, vt.name
      `;
      return trends;
    } catch (error) {
      console.error('Error fetching voucher trends:', error);
      return [];
    }
  }

  async getTopLedgers(companyId: string, limit: number = 10): Promise<any> {
    const topLedgers = await prisma.ledger.findMany({
      where: { companyId },
      select: {
        name: true,
        groupName: true,
        currentBalance: true
      },
      orderBy: {
        currentBalance: 'desc'
      },
      take: limit
    });
    return topLedgers;
  }

  async getStockSummary(companyId: string): Promise<any> {
    const stockSummary = await prisma.stockItem.findMany({
      where: { companyId },
      select: {
        name: true,
        unit: true,
        openingQty: true,
        closingQty: true,
        closingValue: true,
        stockGroup: {
          select: { name: true }
        }
      },
      orderBy: { closingValue: 'desc' }
    });
    return stockSummary;
  }

  async getRecentVouchers(companyId: string, limit: number = 20): Promise<any> {
    const vouchers = await prisma.voucher.findMany({
      select: {
        voucherNumber: true,
        voucherDate: true,
        narration: true,
        totalAmount: true,
        voucherType: {
          select: { name: true }
        }
      },
      where: {
        companyId,
        isCancelled: false
      },
      orderBy: {
        voucherDate: 'desc'
      },
      take: limit
    });
    return vouchers;
  }
}
