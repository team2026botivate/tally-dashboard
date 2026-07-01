import cron from 'node-cron';
import axios from 'axios';

export function initCron(nextjsUrl: string) {
  const DEFAULT_INTERVAL_MS = 300000;

  cron.schedule('* * * * *', async () => {
    try {
      const configRes = await axios.get(`${nextjsUrl}/api/config`);
      const config = configRes.data;
      if (!config || !config.companyName) return;

      const interval = config.syncInterval || DEFAULT_INTERVAL_MS;
      const lastSync = config.lastSyncAt;
      if (lastSync && Date.now() - new Date(lastSync).getTime() < interval) return;

      console.log('[CRON] Starting auto-sync for', config.companyName);
      const syncRes = await axios.post(`${nextjsUrl}/api/tally/sync/${config.id}`);
      console.log('[CRON] Auto-sync triggered:', syncRes.data.message);
    } catch (err: any) {
      console.error('[CRON] Auto-sync failed:', err.message);
    }
  });

  console.log('[CRON] Auto-sync checker running (checks every minute)');
}
