import { prisma } from '../database/prismaClient.js';
import { Prisma } from '@prisma/client';

export class DataTransformer {
  async transformAndSaveLedgers(rawLedgers: any): Promise<number> {
    const ledgers = this.extractLedgers(rawLedgers);
    
    if (ledgers.length === 0) {
      console.log('No ledgers to process');
      return 0;
    }

    const result = await prisma.$transaction(async (tx) => {
      let processed = 0;
      
      for (const ledger of ledgers) {
        await tx.ledger.upsert({
          where: { tallyId: ledger.tallyId },
          update: {
            name: ledger.name,
            groupName: ledger.groupName,
            openingBalance: ledger.openingBalance,
            currentBalance: ledger.currentBalance,
            lastSyncAt: new Date()
          },
          create: {
            tallyId: ledger.tallyId,
            name: ledger.name,
            groupName: ledger.groupName,
            openingBalance: ledger.openingBalance,
            currentBalance: ledger.currentBalance
          }
        });
        processed++;
      }
      
      return processed;
    });

    return result;
  }

  async transformAndSaveStockGroups(rawStockGroups: any): Promise<number> {
    const stockGroups = this.extractStockGroups(rawStockGroups);
    
    if (stockGroups.length === 0) {
      console.log('No stock groups to process');
      return 0;
    }

    const result = await prisma.$transaction(async (tx) => {
      let processed = 0;
      
      for (const sg of stockGroups) {
        await tx.stockGroup.upsert({
          where: { tallyId: sg.tallyId },
          update: {
            name: sg.name,
            parentGroup: sg.parentGroup
          },
          create: {
            tallyId: sg.tallyId,
            name: sg.name,
            parentGroup: sg.parentGroup
          }
        });
        processed++;
      }
      
      return processed;
    });

    return result;
  }

  async transformAndSaveStockItems(rawStockItems: any): Promise<number> {
    const stockItems = this.extractStockItems(rawStockItems);
    
    if (stockItems.length === 0) {
      console.log('No stock items to process');
      return 0;
    }

    const result = await prisma.$transaction(async (tx) => {
      let processed = 0;
      
      for (const item of stockItems) {
        const stockGroup = await tx.stockGroup.findFirst({
          where: { name: item.groupName }
        });
        
        if (stockGroup) {
          await tx.stockItem.upsert({
            where: { tallyId: item.tallyId },
            update: {
              name: item.name,
              unit: item.unit,
              openingQty: item.openingQty,
              openingValue: item.openingValue,
              closingQty: item.closingQty,
              closingValue: item.closingValue,
              rate: item.rate,
              gstRate: item.gstRate,
              hsnCode: item.hsnCode,
              stockGroupId: stockGroup.id,
              lastSyncAt: new Date()
            },
            create: {
              tallyId: item.tallyId,
              name: item.name,
              unit: item.unit,
              openingQty: item.openingQty,
              openingValue: item.openingValue,
              closingQty: item.closingQty,
              closingValue: item.closingValue,
              rate: item.rate,
              gstRate: item.gstRate,
              hsnCode: item.hsnCode,
              stockGroupId: stockGroup.id
            }
          });
          processed++;
        }
      }
      
      return processed;
    });

    return result;
  }

  async transformAndSaveVouchers(rawVouchers: any): Promise<number> {
    const vouchers = this.extractVouchers(rawVouchers);
    
    if (vouchers.length === 0) {
      console.log('No vouchers to process');
      return 0;
    }

    let processed = 0;
    const batchSize = 100;
    
    for (let i = 0; i < vouchers.length; i += batchSize) {
      const batch = vouchers.slice(i, i + batchSize);
      
      await prisma.$transaction(async (tx) => {
        for (const voucher of batch) {
          const voucherType = await tx.voucherType.upsert({
            where: { name: voucher.type },
            update: {},
            create: { name: voucher.type }
          });

          const savedVoucher = await tx.voucher.upsert({
            where: { tallyId: voucher.tallyId },
            update: {
              voucherNumber: voucher.number,
              voucherDate: voucher.date,
              narration: voucher.narration,
              totalAmount: voucher.totalAmount,
              lastSyncAt: new Date()
            },
            create: {
              tallyId: voucher.tallyId,
              voucherNumber: voucher.number,
              voucherDate: voucher.date,
              voucherTypeId: voucherType.id,
              narration: voucher.narration,
              totalAmount: voucher.totalAmount
            }
          });

          for (const entry of voucher.entries) {
            const ledger = await tx.ledger.findUnique({
              where: { tallyId: entry.ledgerId }
            });

            if (ledger) {
              await tx.voucherEntry.upsert({
                where: { tallyId: entry.tallyId },
                update: {
                  amount: entry.amount,
                  entryType: entry.type
                },
                create: {
                  tallyId: entry.tallyId,
                  voucherId: savedVoucher.id,
                  ledgerId: ledger.id,
                  amount: entry.amount,
                  entryType: entry.type
                }
              });
            }
          }

          processed++;
        }
      });
    }

    return processed;
  }

  private extractLedgers(data: any): any[] {
    const ledgers: any[] = [];
    
    if (!data) return ledgers;
    
    try {
      const processGroup = (group: any) => {
        if (group.ledgers) {
          group.ledgers.forEach((ledger: any) => {
            ledgers.push({
              tallyId: ledger.guid || ledger.name,
              name: ledger.name,
              groupName: group.name,
              openingBalance: parseFloat(ledger.openingBalance || 0),
              currentBalance: parseFloat(ledger.closingBalance || 0)
            });
          });
        }
        if (group.groups) {
          group.groups.forEach(processGroup);
        }
      };
      
      if (data.groups) {
        data.groups.forEach(processGroup);
      } else if (data.ledgers) {
        data.ledgers.forEach((ledger: any) => {
          ledgers.push({
            tallyId: ledger.guid || ledger.name,
            name: ledger.name,
            groupName: data.groupName || 'Primary',
            openingBalance: parseFloat(ledger.openingBalance || 0),
            currentBalance: parseFloat(ledger.closingBalance || 0)
          });
        });
      }
    } catch (error) {
      console.error('Error extracting ledgers:', error);
    }
    
    return ledgers;
  }

  private extractStockGroups(data: any): any[] {
    const stockGroups: any[] = [];
    
    if (!data) return stockGroups;
    
    try {
      if (data.groups) {
        data.groups.forEach((sg: any) => {
          stockGroups.push({
            tallyId: sg.guid || sg.name,
            name: sg.name,
            parentGroup: sg.parentGroup || null
          });
        });
      }
    } catch (error) {
      console.error('Error extracting stock groups:', error);
    }
    
    return stockGroups;
  }

  private extractStockItems(data: any): any[] {
    const stockItems: any[] = [];
    
    if (!data) return stockItems;
    
    try {
      if (data.items) {
        data.items.forEach((item: any) => {
          stockItems.push({
            tallyId: item.guid || item.name,
            name: item.name,
            unit: item.unit || 'PCS',
            openingQty: parseFloat(item.openingQty || 0),
            openingValue: parseFloat(item.openingValue || 0),
            closingQty: parseFloat(item.closingQty || 0),
            closingValue: parseFloat(item.closingValue || 0),
            rate: parseFloat(item.rate || 0),
            gstRate: parseFloat(item.gstRate || 0),
            hsnCode: item.hsnCode || null,
            groupName: data.groupName || 'Primary'
          });
        });
      }
    } catch (error) {
      console.error('Error extracting stock items:', error);
    }
    
    return stockItems;
  }

  private extractVouchers(data: any): any[] {
    const vouchers: any[] = [];
    
    if (!data) return vouchers;
    
    try {
      if (data.vouchers) {
        data.vouchers.forEach((voucher: any) => {
          vouchers.push({
            tallyId: voucher.guid || voucher.number,
            number: voucher.number,
            date: new Date(voucher.date || voucher.voucherDate),
            type: voucher.type || voucher.voucherType,
            narration: voucher.narration || '',
            totalAmount: parseFloat(voucher.totalAmount || 0),
            entries: (voucher.entries || []).map((entry: any, idx: number) => ({
              tallyId: `${voucher.guid || voucher.number}-${idx}`,
              ledgerId: entry.ledgerId || entry.ledgerName,
              amount: parseFloat(entry.amount || 0),
              type: entry.type || entry.entryType || 'DR'
            }))
          });
        });
      }
    } catch (error) {
      console.error('Error extracting vouchers:', error);
    }
    
    return vouchers;
  }
}