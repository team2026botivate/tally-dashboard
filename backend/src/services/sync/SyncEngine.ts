import { prisma } from '../database/prismaClient.js';
import { TallyDataFetcher } from '../tally/TallyFetcher.js';
import { DataTransformer } from '../tally/DataTransformer.js';
import { SyncType, SyncStatus } from '@prisma/client';

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  details: {
    ledgers: number;
    stockGroups: number;
    stockItems: number;
    vouchers: number;
  };
}

export class SyncEngine {
  private fetcher: TallyDataFetcher;
  private transformer: DataTransformer;

  constructor(config: any) {
    this.fetcher = new TallyDataFetcher(config);
    this.transformer = new DataTransformer();
  }

  async performFullSync(configId: string): Promise<SyncResult> {
    const syncLog = await prisma.syncLog.create({
      data: {
        syncType: SyncType.FULL,
        status: SyncStatus.IN_PROGRESS,
        recordsProcessed: 0
      }
    });

    try {
      console.log('Fetching masters...');
      const masters = await this.fetcher.fetchAllMasters();

      console.log('Saving ledgers...');
      const ledgerCount = await this.transformer.transformAndSaveLedgers(masters.ledgers, configId);

      console.log('Saving stock groups...');
      const stockGroupCount = await this.transformer.transformAndSaveStockGroups(masters.stockGroups, configId);

      console.log('Saving stock items...');
      const stockItemCount = await this.transformer.transformAndSaveStockItems(masters.stockItems, configId);

      console.log('Fetching vouchers...');
      const voucherCount = await this.fetchAndSaveVouchersInBatches(configId);

      console.log('Updating sync metadata...');
      await this.updateSyncMetadata();

      console.log('Updating configuration...');
      await prisma.tallyConfiguration.update({
        where: { id: configId },
        data: { lastSyncAt: new Date() }
      });

      const totalProcessed = ledgerCount + stockGroupCount + stockItemCount + voucherCount;

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: SyncStatus.COMPLETED,
          recordsProcessed: totalProcessed,
          completedAt: new Date()
        }
      });

      return {
        success: true,
        recordsProcessed: totalProcessed,
        details: {
          ledgers: ledgerCount,
          stockGroups: stockGroupCount,
          stockItems: stockItemCount,
          vouchers: voucherCount
        }
      };

    } catch (error: any) {
      console.error('Sync failed:', error);

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: SyncStatus.FAILED,
          errorMessage: error.message,
          errors: error,
          completedAt: new Date()
        }
      });

      throw error;
    }
  }

  async performLedgerSync(configId: string): Promise<number> {
    const syncLog = await prisma.syncLog.create({
      data: { syncType: SyncType.FULL, status: SyncStatus.IN_PROGRESS, recordsProcessed: 0 }
    });
    try {
      console.log('Syncing ledgers...');
      const data = await this.fetcher.fetchReport('LedgerList');
      const count = await this.transformer.transformAndSaveLedgers(data, configId);
      await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncStatus.COMPLETED, recordsProcessed: count, completedAt: new Date() } });
      return count;
    } catch (error: any) {
      await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncStatus.FAILED, errorMessage: error.message, completedAt: new Date() } });
      throw error;
    }
  }

  async performStockSync(configId: string): Promise<number> {
    const syncLog = await prisma.syncLog.create({
      data: { syncType: SyncType.FULL, status: SyncStatus.IN_PROGRESS, recordsProcessed: 0 }
    });
    try {
      console.log('Syncing stock groups...');
      const groupsData = await this.fetcher.fetchReport('StockGroupList');
      const groupCount = await this.transformer.transformAndSaveStockGroups(groupsData, configId);
      console.log('Syncing stock items...');
      const itemsData = await this.fetcher.fetchReport('StockItemList');
      const itemCount = await this.transformer.transformAndSaveStockItems(itemsData, configId);
      const total = groupCount + itemCount;
      await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncStatus.COMPLETED, recordsProcessed: total, completedAt: new Date() } });
      return total;
    } catch (error: any) {
      await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncStatus.FAILED, errorMessage: error.message, completedAt: new Date() } });
      throw error;
    }
  }

  async performVoucherSync(configId: string, fromDate?: Date, toDate?: Date): Promise<number> {
    const syncLog = await prisma.syncLog.create({
      data: { syncType: SyncType.INCREMENTAL, status: SyncStatus.IN_PROGRESS, recordsProcessed: 0 }
    });
    try {
      const count = await this.fetchAndSaveVouchersInBatches(configId, fromDate, toDate);
      await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncStatus.COMPLETED, recordsProcessed: count, completedAt: new Date() } });
      return count;
    } catch (error: any) {
      await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncStatus.FAILED, errorMessage: error.message, completedAt: new Date() } });
      throw error;
    }
  }

  async performIncrementalSync(configId: string): Promise<SyncResult> {
    const config = await prisma.tallyConfiguration.findUnique({
      where: { id: configId }
    });

    if (!config) throw new Error('Configuration not found');

    const syncLog = await prisma.syncLog.create({
      data: {
        syncType: SyncType.INCREMENTAL,
        status: SyncStatus.IN_PROGRESS,
        recordsProcessed: 0
      }
    });

    try {
      const lastSync = await prisma.syncMetadata.findFirst({
        where: { entityType: 'vouchers' }
      });

      const fromDate = lastSync?.lastSyncTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = new Date();

      const voucherCount = await this.fetchAndSaveVouchersInBatches(configId, fromDate, toDate);

      await prisma.syncMetadata.upsert({
        where: { entityType: 'vouchers' },
        update: { lastSyncTime: new Date() },
        create: { entityType: 'vouchers', lastSyncTime: new Date() }
      });

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: SyncStatus.COMPLETED,
          recordsProcessed: voucherCount,
          completedAt: new Date()
        }
      });

      return {
        success: true,
        recordsProcessed: voucherCount,
        details: { vouchers: voucherCount, ledgers: 0, stockGroups: 0, stockItems: 0 }
      };

    } catch (error: any) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: SyncStatus.FAILED,
          errorMessage: error.message,
          completedAt: new Date()
        }
      });

      throw error;
    }
  }

  private async fetchAndSaveVouchersInBatches(configId: string, fromDate?: Date, toDate?: Date): Promise<number> {
    let totalProcessed = 0;
    
    console.log('Fetching all vouchers in single batch...');
    const rawVouchers = await this.fetcher.fetchVouchers(fromDate, toDate);
    const voucherArray = rawVouchers?.vouchers || [];

    console.log(`Fetched ${voucherArray.length} vouchers`);

    const processed = await this.transformer.transformAndSaveVouchers(rawVouchers, configId);
    totalProcessed += processed;

    return totalProcessed;
  }

  private async updateSyncMetadata(): Promise<void> {
    const now = new Date();
    const entities = ['ledgers', 'stockGroups', 'stockItems', 'vouchers'];

    for (const entity of entities) {
      await prisma.syncMetadata.upsert({
        where: { entityType: entity },
        update: { lastSyncTime: now },
        create: { entityType: entity, lastSyncTime: now }
      });
    }
  }
}