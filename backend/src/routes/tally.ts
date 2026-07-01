import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../services/database/prismaClient.js';
import { SyncEngine } from '../services/sync/SyncEngine.js';
import { TallyDataFetcher } from '../services/tally/TallyFetcher.js';

const router = Router();

function createSyncEngine(config: any) {
  return new SyncEngine(config);
}

// Helper to get active config
async function getActiveConfig() {
  const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
  if (!config) throw new Error('No active Tally configuration found');
  return config;
}


// ── TEST CONNECTION ────────────────────────────────────────────
router.get('/ping', async (req, res) => {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return res.status(404).json({ connected: false, host: null, port: null, error: 'No active Tally configuration found. Please configure Tally in Settings first.' });
    const fetcher = new TallyDataFetcher(config);
    await fetcher.fetchReport('CompanyInfo');
    res.json({ connected: true, host: config.host, port: config.port });
  } catch (error: any) {
    res.status(503).json({ connected: false, host: null, port: null, error: error.message });
  }
});

// POST /api/tally/test-connection (legacy)
router.post('/test-connection', async (req, res) => {
  const { host, port, companyName, isRemote, gatewayId } = req.body;
  try {
    const fetcher = new TallyDataFetcher({ host, port, companyName: companyName || '', isRemote, gatewayId, authToken: null } as any);
    await fetcher.fetchReport('CompanyInfo');
    res.json({ success: true, message: 'Connected successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET COMPANIES (from Tally) ─────────────────────────────────
router.get('/companies', async (req, res) => {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return res.status(404).json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' });

    const fetcher = new TallyDataFetcher(config);
    const parsed = await fetcher.fetchReport('CompanyInfo');

    const companiesList = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.[0]?.COMPANY || [];
    const companyNames: string[] = companiesList.map((c: any) => 
      typeof c.NAME === 'object' ? c.NAME['#text'] : c.NAME
    ).filter(Boolean);

    const companies = [...new Set(companyNames)].map((name, i) => ({
      id: `tally-${i}`,
      companyName: name
    }));

    res.json(companies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DATA RETRIEVAL ENDPOINTS ───────────────────────────────────
router.get('/ledgers', async (req, res) => {
  try {
    const { limit } = req.query;
    const ledgers = await prisma.ledger.findMany({
      select: {
        id: true, name: true, groupName: true, openingBalance: true,
        currentBalance: true, isActive: true, lastSyncAt: true
      },
      orderBy: { name: 'asc' },
      take: limit ? parseInt(String(limit)) : undefined
    });
    res.json(ledgers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/vouchers', async (req, res) => {
  try {
    const { from, to, type, limit } = req.query;
    const where: any = { isCancelled: false };
    if (from) where.voucherDate = { ...where.voucherDate, gte: new Date(String(from)) };
    if (to) where.voucherDate = { ...where.voucherDate, lte: new Date(String(to)) };
    if (type) where.voucherType = { name: String(type) };
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
      take: limit ? parseInt(String(limit)) : 100
    });
    res.json(vouchers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stock', async (req, res) => {
  try {
    const items = await prisma.stockItem.findMany({
      select: {
        id: true, name: true, unit: true, openingQty: true, closingQty: true,
        closingValue: true, rate: true, gstRate: true, hsnCode: true,
        stockGroup: { select: { name: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sync-log', async (req, res) => {
  try {
    const logs = await prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PER-TYPE SYNC ENDPOINTS ────────────────────────────────────
async function runSync(configId: string, syncFn: (engine: SyncEngine, configId: string) => Promise<any>) {
  const config = await prisma.tallyConfiguration.findUnique({ where: { id: configId } });
  if (!config) throw new Error('Configuration not found');
  const engine = createSyncEngine(config);
  return syncFn(engine, configId);
}

router.post('/sync/ledgers', async (req, res) => {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return res.status(400).json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' });
    createSyncEngine(config).performLedgerSync(config.id).catch(console.error);
    res.json({ message: 'Ledger sync started', configId: config.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sync/vouchers', async (req, res) => {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return res.status(400).json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' });
    const { fromDate, toDate } = req.body;
    createSyncEngine(config).performVoucherSync(config.id, fromDate, toDate).catch(console.error);
    res.json({ message: 'Voucher sync started', configId: config.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sync/stock', async (req, res) => {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return res.status(400).json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' });
    createSyncEngine(config).performStockSync(config.id).catch(console.error);
    res.json({ message: 'Stock sync started', configId: config.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sync/full', async (req, res) => {
  try {
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    if (!config) return res.status(400).json({ error: 'No active Tally configuration found. Please configure Tally in Settings first.' });
    createSyncEngine(config).performFullSync(config.id).catch(console.error);
    res.json({ message: 'Full sync started successfully', configId: config.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sync/:configId', async (req, res) => {
  try {
    const config = await prisma.tallyConfiguration.findUnique({ where: { id: req.params.configId } });
    if (!config) return res.status(404).json({ error: 'Configuration not found' });
    createSyncEngine(config).performFullSync(config.id).catch(console.error);
    res.json({ message: 'Full sync started successfully', configId: config.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sync/status', async (req, res) => {
  try {
    const latestSync = await prisma.syncLog.findFirst({ orderBy: { startedAt: 'desc' } });
    const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
    res.json({
      lastSync: latestSync,
      lastSyncTime: config?.lastSyncAt,
      isConfigured: !!config
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
