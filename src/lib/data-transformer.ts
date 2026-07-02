import { prisma } from './prisma';

export class DataTransformer {
  private parseTallyDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(Date.UTC(year, month, day));
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  async transformAndSaveLedgers(rawLedgers: any, companyId: string): Promise<number> {
    const ledgers = this.extractLedgers(rawLedgers);

    if (ledgers.length === 0) {
      console.log('No ledgers to process');
      return 0;
    }

    let processed = 0;
    const batchSize = 100;

    for (let i = 0; i < ledgers.length; i += batchSize) {
      const batch = ledgers.slice(i, i + batchSize);

      const params: any[] = [];
      const placeholders: string[] = [];
      let idx = 1;

      for (const l of batch) {
        placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}::decimal, $${idx + 5}::decimal, $${idx + 6}::timestamp, $${idx + 7}, $${idx + 6}::timestamp)`);
        params.push(l.tallyId, companyId, l.name, l.groupName, l.openingBalance, l.currentBalance, new Date(), l.parentGroup || null);
        idx += 8;
      }

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Ledger" ("tallyId", "companyId", "name", "groupName", "openingBalance", "currentBalance", "lastSyncAt", "parentGroup", "updatedAt")
        VALUES ${placeholders.join(', ')}
        ON CONFLICT ("tallyId", "companyId") DO UPDATE SET
          "name" = EXCLUDED."name",
          "groupName" = EXCLUDED."groupName",
          "parentGroup" = EXCLUDED."parentGroup",
          "openingBalance" = EXCLUDED."openingBalance",
          "currentBalance" = EXCLUDED."currentBalance",
          "lastSyncAt" = EXCLUDED."lastSyncAt",
          "updatedAt" = EXCLUDED."updatedAt"
      `, ...params);
      processed += batch.length;
    }

    return processed;
  }

  async transformAndSaveStockGroups(rawStockGroups: any, companyId: string): Promise<number> {
    const stockGroups = this.extractStockGroups(rawStockGroups);

    if (stockGroups.length === 0) {
      console.log('No stock groups to process');
      return 0;
    }

    const params: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const sg of stockGroups) {
      placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, NOW())`);
      params.push(sg.tallyId, companyId, sg.name, sg.parentGroup || null);
      idx += 4;
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO "StockGroup" ("tallyId", "companyId", "name", "parentGroup", "updatedAt")
      VALUES ${placeholders.join(', ')}
      ON CONFLICT ("tallyId", "companyId") DO UPDATE SET
        "name" = EXCLUDED."name",
        "parentGroup" = EXCLUDED."parentGroup",
        "updatedAt" = EXCLUDED."updatedAt"
    `, ...params);

    return stockGroups.length;
  }

  async transformAndSaveStockItems(rawStockItems: any, companyId: string): Promise<number> {
    const stockItems = this.extractStockItems(rawStockItems);

    if (stockItems.length === 0) {
      console.log('No stock items to process');
      return 0;
    }

    const stockGroups = await prisma.stockGroup.findMany({
      where: { companyId },
      select: { id: true, name: true }
    });
    const stockGroupMap = new Map<string, string>(stockGroups.map(sg => [sg.name, sg.id]));

    let processed = 0;
    const batchSize = 50;

    for (let i = 0; i < stockItems.length; i += batchSize) {
      const batch = stockItems.slice(i, i + batchSize);
      const params: any[] = [];
      const placeholders: string[] = [];
      let idx = 1;

      for (const item of batch) {
        let stockGroupId = stockGroupMap.get(item.groupName);

        // Auto-create a 'Primary' stock group if no match found
        if (!stockGroupId) {
          let fallbackGroup = await prisma.stockGroup.findFirst({
            where: { companyId, name: 'Primary' }
          });
          if (!fallbackGroup) {
            fallbackGroup = await prisma.stockGroup.create({
              data: { tallyId: `primary-${companyId}`, companyId, name: 'Primary', parentGroup: null }
            });
          }
          stockGroupId = fallbackGroup.id;
          stockGroupMap.set(item.groupName, stockGroupId);
        }

        placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}::decimal, $${idx + 5}::decimal, $${idx + 6}::decimal, $${idx + 7}::decimal, $${idx + 8}::decimal, $${idx + 9}::decimal, $${idx + 10}, $${idx + 11}, $${idx + 12}::timestamp, $${idx + 12}::timestamp)`);
        params.push(
          item.tallyId, companyId, item.name, item.unit,
          item.openingQty, item.openingValue, item.closingQty, item.closingValue,
          item.rate, item.gstRate,
          item.hsnCode || null,
          stockGroupId,
          new Date()
        );
        idx += 13;
        processed++;
      }

      if (placeholders.length > 0) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "StockItem" ("tallyId", "companyId", "name", "unit", "openingQty", "openingValue", "closingQty", "closingValue", "rate", "gstRate", "hsnCode", "stockGroupId", "lastSyncAt", "updatedAt")
          VALUES ${placeholders.join(', ')}
          ON CONFLICT ("tallyId", "companyId") DO UPDATE SET
            "name" = EXCLUDED."name",
            "unit" = EXCLUDED."unit",
            "openingQty" = EXCLUDED."openingQty",
            "openingValue" = EXCLUDED."openingValue",
            "closingQty" = EXCLUDED."closingQty",
            "closingValue" = EXCLUDED."closingValue",
            "rate" = EXCLUDED."rate",
            "gstRate" = EXCLUDED."gstRate",
            "hsnCode" = EXCLUDED."hsnCode",
            "stockGroupId" = EXCLUDED."stockGroupId",
            "lastSyncAt" = EXCLUDED."lastSyncAt",
            "updatedAt" = EXCLUDED."updatedAt"
        `, ...params);
      }
    }

    return processed;
  }

  async transformAndSaveVouchers(rawVouchers: any, companyId: string): Promise<number> {
    const vouchers = this.extractVouchers(rawVouchers);

    if (vouchers.length === 0) {
      console.log('No vouchers to process');
      return 0;
    }

    const ledgers = await prisma.ledger.findMany({
      where: { companyId },
      select: { id: true, tallyId: true, name: true }
    });

    const ledgerMapByTallyId = new Map<string, string>();
    const ledgerMapByName = new Map<string, string>();
    for (const l of ledgers) {
      if (l.tallyId) ledgerMapByTallyId.set(l.tallyId.trim().toLowerCase(), l.id);
      if (l.name) ledgerMapByName.set(l.name.trim().toLowerCase(), l.id);
    }

    const existingVoucherTypes = await prisma.voucherType.findMany();
    const voucherTypeMap = new Map<string, string>(existingVoucherTypes.map(vt => [vt.name, vt.id]));

    const missingTypes = [...new Set(vouchers.map(v => v.type).filter(t => t && !voucherTypeMap.has(t)))];
    if (missingTypes.length > 0) {
      await prisma.$transaction(
        missingTypes.map(name =>
          prisma.voucherType.upsert({
            where: { name },
            update: {},
            create: { name }
          })
        )
      );
      const updatedTypes = await prisma.voucherType.findMany();
      for (const vt of updatedTypes) {
        voucherTypeMap.set(vt.name, vt.id);
      }
    }

    let processed = 0;
    const batchSize = 100;

    for (let i = 0; i < vouchers.length; i += batchSize) {
      const batch = vouchers.slice(i, i + batchSize);

      const vParams: any[] = [];
      const vPlaceholders: string[] = [];
      let vIdx = 1;

      for (const v of batch) {
        const voucherTypeId = voucherTypeMap.get(v.type) || '';
        vPlaceholders.push(`(gen_random_uuid()::text, $${vIdx}, $${vIdx + 1}, $${vIdx + 2}, $${vIdx + 3}::timestamp, $${vIdx + 4}, $${vIdx + 5}, $${vIdx + 6}::decimal, $${vIdx + 7}::timestamp, $${vIdx + 7}::timestamp)`);
        vParams.push(v.tallyId, companyId, v.number, v.date, voucherTypeId, v.narration || '', v.totalAmount, new Date());
        vIdx += 8;
      }

      const savedVouchers = await prisma.$queryRawUnsafe<Array<{ id: string; tally_id: string }>>(`
        INSERT INTO "Voucher" ("id", "tallyId", "companyId", "voucherNumber", "voucherDate", "voucherTypeId", "narration", "totalAmount", "lastSyncAt", "updatedAt")
        VALUES ${vPlaceholders.join(', ')}
        ON CONFLICT ("tallyId", "companyId") DO UPDATE SET
          "voucherNumber" = EXCLUDED."voucherNumber",
          "voucherDate" = EXCLUDED."voucherDate",
          "voucherTypeId" = EXCLUDED."voucherTypeId",
          "narration" = EXCLUDED."narration",
          "totalAmount" = EXCLUDED."totalAmount",
          "lastSyncAt" = EXCLUDED."lastSyncAt",
          "updatedAt" = EXCLUDED."updatedAt"
        RETURNING "id", "tallyId" as tally_id
      `, ...vParams);

      const voucherIdMap = new Map<string, string>();
      for (const sv of savedVouchers) {
        voucherIdMap.set(sv.tally_id, sv.id);
      }

      const allEntries: Array<{
        tallyId: string;
        companyId: string;
        voucherId: string;
        ledgerId: string;
        amount: number;
        entryType: string;
      }> = [];

      for (const v of batch) {
        const savedId = voucherIdMap.get(v.tallyId);
        if (!savedId) continue;

        for (const entry of v.entries) {
          const lookupKey = (entry.ledgerId || '').trim().toLowerCase();
          const ledgerId = ledgerMapByTallyId.get(lookupKey) || ledgerMapByName.get(lookupKey);
          if (!ledgerId) continue;

          allEntries.push({
            tallyId: entry.tallyId,
            companyId,
            voucherId: savedId,
            ledgerId,
            amount: entry.amount,
            entryType: entry.type,
          });
        }
      }

      if (allEntries.length > 0) {
        const eParams: any[] = [];
        const ePlaceholders: string[] = [];
        let eIdx = 1;

        for (const e of allEntries) {
          ePlaceholders.push(`(gen_random_uuid()::text, $${eIdx}, $${eIdx + 1}, $${eIdx + 2}, $${eIdx + 3}, $${eIdx + 4}::decimal, $${eIdx + 5}::"EntryType")`);
          eParams.push(e.tallyId, e.companyId, e.voucherId, e.ledgerId, e.amount, e.entryType);
          eIdx += 6;
        }

        await prisma.$executeRawUnsafe(`
          INSERT INTO "VoucherEntry" ("id", "tallyId", "companyId", "voucherId", "ledgerId", "amount", "entryType")
          VALUES ${ePlaceholders.join(', ')}
          ON CONFLICT ("tallyId", "companyId") DO UPDATE SET
            "amount" = EXCLUDED."amount",
            "entryType" = EXCLUDED."entryType"
        `, ...eParams);
      }

      processed += batch.length;
    }

    return processed;
  }

  private extractLedgers(data: any): any[] {
    const ledgers: any[] = [];
    if (!data) return ledgers;

    try {
      // Handle flat array from agent (e.g. [{tallyId, name, groupName, ...}])
      if (Array.isArray(data)) {
        return data.map((l: any) => ({
          tallyId: l.tallyId || l.guid || l.name,
          name: l.name,
          groupName: l.groupName || 'Primary',
          parentGroup: l.parentGroup || l.groupName || 'Primary',
          openingBalance: parseFloat(l.openingBalance || 0),
          currentBalance: parseFloat(l.currentBalance || l.closingBalance || 0),
        }));
      }

      // Handle {groups: [...]} where groups contain ledger objects directly
      if (data.groups && Array.isArray(data.groups)) {
        const first = data.groups[0];
        // If items look like ledger objects (have tallyId), it's a flat list wrapped in groups
        if (first && (first.tallyId || first.guid) && first.name && !first.ledgers && !first.groups) {
          return data.groups.map((l: any) => ({
            tallyId: l.tallyId || l.guid || l.name,
            name: l.name,
            groupName: l.groupName || 'Primary',
            parentGroup: l.parentGroup || l.groupName || 'Primary',
            openingBalance: parseFloat(l.openingBalance || 0),
            currentBalance: parseFloat(l.currentBalance || l.closingBalance || 0),
          }));
        }

        // Handle true tree structure
        const processGroup = (group: any, rootGroupName?: string) => {
          const currentRoot = rootGroupName || group.name;
          if (group.ledgers) {
            group.ledgers.forEach((ledger: any) => {
              ledgers.push({
                tallyId: ledger.guid || ledger.name,
                name: ledger.name,
                groupName: group.name,
                parentGroup: currentRoot,
                openingBalance: parseFloat(ledger.openingBalance || 0),
                currentBalance: parseFloat(ledger.closingBalance || ledger.currentBalance || 0)
              });
            });
          }
          if (group.groups) {
            group.groups.forEach((g: any) => processGroup(g, currentRoot));
          }
        };
        data.groups.forEach((g: any) => processGroup(g));
      } else if (data.ledgers) {
        data.ledgers.forEach((ledger: any) => {
          ledgers.push({
            tallyId: ledger.guid || ledger.name,
            name: ledger.name,
            groupName: data.groupName || 'Primary',
            parentGroup: data.groupName || 'Primary',
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
      // Handle flat array
      const source = Array.isArray(data) ? data
        : (data.groups && Array.isArray(data.groups)) ? data.groups
        : [];

      source.forEach((sg: any) => {
        if (!sg || typeof sg !== 'object') return;
        stockGroups.push({
          tallyId: sg.tallyId || sg.guid || sg.name,
          name: sg.name,
          parentGroup: sg.parentGroup || null
        });
      });
    } catch (error) {
      console.error('Error extracting stock groups:', error);
    }

    return stockGroups;
  }

  private extractStockItems(data: any): any[] {
    const stockItems: any[] = [];
    if (!data) return stockItems;

    try {
      // Handle flat array
      const source = Array.isArray(data) ? data
        : (data.items && Array.isArray(data.items)) ? data.items
        : [];

      source.forEach((item: any) => {
        if (!item || typeof item !== 'object') return;
        stockItems.push({
          tallyId: item.tallyId || item.guid || item.name,
          name: item.name,
          unit: item.unit || 'PCS',
          openingQty: parseFloat(item.openingQty || 0),
          openingValue: parseFloat(item.openingValue || 0),
          closingQty: parseFloat(item.closingQty || 0),
          closingValue: parseFloat(item.closingValue || 0),
          rate: parseFloat(item.rate || 0),
          gstRate: parseFloat(item.gstRate || 0),
          hsnCode: item.hsnCode || null,
          groupName: item.groupName || data.groupName || 'Primary'
        });
      });
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
            date: this.parseTallyDate(voucher.date || voucher.voucherDate),
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
