import { prisma } from '../database/prismaClient.js';

export class DashboardService {
  async getBalanceSheet(): Promise<any> {
    try {
      const result = await prisma.$queryRaw`
        SELECT 
          'Assets' as category,
          SUM(CASE WHEN e."entryType" = 'DR' THEN e.amount ELSE -e.amount END) as balance
        FROM "VoucherEntry" e
        JOIN "Ledger" l ON e."ledgerId" = l.id
        WHERE l."groupName" IN ('Current Assets', 'Fixed Assets', 'Bank Accounts', 'Sundry Debtors', 'Cash')
        
        UNION ALL
        
        SELECT 
          'Liabilities' as category,
          SUM(CASE WHEN e."entryType" = 'CR' THEN e.amount ELSE -e.amount END) as balance
        FROM "VoucherEntry" e
        JOIN "Ledger" l ON e."ledgerId" = l.id
        WHERE l."groupName" IN ('Current Liabilities', 'Capital Account', 'Loans (Bank)', 'Sundry Creditors')
      `;
      return result;
    } catch (error) {
      console.error('Error fetching balance sheet:', error);
      return [];
    }
  }

  async getTrialBalance(): Promise<any> {
    const ledgers = await prisma.ledger.findMany({
      select: {
        name: true,
        groupName: true,
        openingBalance: true,
        currentBalance: true
      },
      orderBy: { name: 'asc' }
    });
    return ledgers;
  }

  async getVoucherTrends(days: number = 30): Promise<any> {
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
        WHERE v."voucherDate" >= ${startDate}
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

  async getTopLedgers(limit: number = 10): Promise<any> {
    const topLedgers = await prisma.ledger.findMany({
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

  async getStockSummary(): Promise<any> {
    const stockSummary = await prisma.stockItem.findMany({
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

  async getRecentVouchers(limit: number = 20): Promise<any> {
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