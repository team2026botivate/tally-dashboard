import { Router } from 'express';
import { DashboardService } from '../services/dashboard/DashboardService.js';

const router = Router();
const dashboardService = new DashboardService();

router.get('/balance-sheet', async (req, res) => {
  try {
    const data = await dashboardService.getBalanceSheet();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/trial-balance', async (req, res) => {
  try {
    const data = await dashboardService.getTrialBalance();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/voucher-trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await dashboardService.getVoucherTrends(days);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/top-ledgers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await dashboardService.getTopLedgers(limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stock-summary', async (req, res) => {
  try {
    const data = await dashboardService.getStockSummary();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recent-vouchers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await dashboardService.getRecentVouchers(limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;