import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { prisma } from './services/database/prismaClient.js';
import tallyRoutes from './routes/tally.js';
import configRoutes from './routes/config.js';
import dashboardRoutes from './routes/dashboard.js';
import usersRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';
import { SyncEngine } from './services/sync/SyncEngine.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

app.use('/api/tally', tallyRoutes);
app.use('/api/config', configRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/auth', authRoutes);

app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  res.json({ 
    status: 'ok', 
    database: dbHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Auto-sync cron job — picks syncInterval from the active config
function startAutoSync() {
  const DEFAULT_INTERVAL_MS = 300000;
  cron.schedule('* * * * *', async () => { // runs every minute, checks if due
    try {
      const config = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
      if (!config || !config.companyName) return;
      const interval = config.syncInterval || DEFAULT_INTERVAL_MS;
      const lastSync = config.lastSyncAt;
      if (lastSync && Date.now() - new Date(lastSync).getTime() < interval) return;
      console.log('[CRON] Starting auto-sync for', config.companyName);
      const engine = new SyncEngine(config);
      await engine.performFullSync(config.id);
      console.log('[CRON] Auto-sync complete');
    } catch (err: any) {
      console.error('[CRON] Auto-sync failed:', err.message);
    }
  });
  console.log('[CRON] Auto-sync checker running (checks every minute)');
}

app.listen(PORT, async () => {
  console.log(`Backend service running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
    startAutoSync();
  }
});

export default app;