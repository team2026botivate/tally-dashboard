import { prisma } from '../database/prismaClient.js';

export class DashboardService {
  async getBalanceSheet(companyId: string): Promise<any> {
    try {
      const result = await prisma.$queryRaw`
        SELECT 
          'Assets' as category,
          SUM("currentBalance") as balance
        FROM "Ledger" l
        WHERE l."companyId" = ${companyId}
          AND l."parentGroup" IN (
            'Current Assets', 'Fixed Assets', 'Investments', 'Bank Accounts', 
            'Cash-in-hand', 'Cash-in-Hand', 'Sundry Debtors', 'Loans & Advances (Asset)', 
            'Deposits (Asset)', 'Misc. Expenses (ASSET)', 'Suspense A/c'
          )
        
        UNION ALL
        
        SELECT 
          'Liabilities' as category,
          SUM("currentBalance") as balance
        FROM "Ledger" l
        WHERE l."companyId" = ${companyId}
          AND l."parentGroup" IN (
            'Current Liabilities', 'Capital Account', 'Loans (Liability)', 'Sundry Creditors', 
            'Duties & Taxes', 'Provisions', 'Bank OD A/c', 'Bank OCC A/c', 
            'Secured Loans', 'Unsecured Loans', 'Reserves & Surplus', 'Branch / Divisions'
          )
      `;
      return result;
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