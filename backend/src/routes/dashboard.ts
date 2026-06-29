import { Router } from 'express';
import { DashboardService } from '../services/dashboard/DashboardService.js';

const router = Router();
const dashboardService = new DashboardService();

router.get('/balance-sheet', async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const data = await dashboardService.getBalanceSheet(companyId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/trial-balance', async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const data = await dashboardService.getTrialBalance(companyId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/voucher-trends', async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const days = parseInt(req.query.days as string) || 30;
    const data = await dashboardService.getVoucherTrends(companyId, days);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/top-ledgers', async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await dashboardService.getTopLedgers(companyId, limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stock-summary', async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const data = await dashboardService.getStockSummary(companyId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recent-vouchers', async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await dashboardService.getRecentVouchers(companyId, limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;