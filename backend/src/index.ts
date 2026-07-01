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

import { createServer } from 'http';
import { SocketServer } from './services/tally/socketServer.js';
import { TallyDataFetcher } from './services/tally/TallyFetcher.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const server = createServer(app);
SocketServer.getInstance().init(server);

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

async function syncConfigFromEnv() {
  const envHost = process.env.TALLY_HOST;
  const envPort = process.env.TALLY_PORT ? parseInt(process.env.TALLY_PORT) : 9000;
  const envIsRemote = process.env.TALLY_IS_REMOTE === 'true' || false;
  const envGatewayId = process.env.TALLY_GATEWAY_ID || null;

  if (envHost) {
    console.log('[CONFIG] Syncing active Tally configuration from environment variables...');
    try {
      if (envIsRemote) {
        // For remote setups, register/update the gateway template configuration
        const existing = await prisma.tallyConfiguration.findFirst({
          where: { gatewayId: envGatewayId }
        });

        if (existing) {
          await prisma.tallyConfiguration.update({
            where: { id: existing.id },
            data: { host: envHost, port: envPort, isRemote: true }
          });
        } else {
          await prisma.tallyConfiguration.create({
            data: {
              host: envHost,
              port: envPort,
              companyName: 'Remote Gateway',
              isRemote: true,
              gatewayId: envGatewayId,
              isActive: false
            }
          });
        }
        console.log('[CONFIG] Remote gateway config registered. Awaiting connection to fetch companies.');
      } else {
        // Direct local/remote IP setup: Auto-fetch all available companies from Tally
        try {
          console.log(`[CONFIG] Attempting to auto-discover companies from Tally at http://${envHost}:${envPort}...`);
          const fetcher = new TallyDataFetcher({ host: envHost, port: envPort, isRemote: false });
          const parsed = await fetcher.fetchReport('CompanyInfo');

          const companiesList = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.[0]?.COMPANY || [];
          const companyNames: string[] = companiesList.map((c: any) => 
            typeof c.NAME === 'object' ? c.NAME['#text'] : c.NAME
          ).filter(Boolean);

          if (companyNames.length > 0) {
            console.log(`[CONFIG] Discovered ${companyNames.length} companies: ${companyNames.join(', ')}`);
            
            // Deactivate other configurations
            await prisma.tallyConfiguration.updateMany({
              where: { isActive: true },
              data: { isActive: false }
            });

            for (let i = 0; i < companyNames.length; i++) {
              const companyName = companyNames[i];
              const existing = await prisma.tallyConfiguration.findFirst({
                where: { host: envHost, companyName }
              });

              if (existing) {
                await prisma.tallyConfiguration.update({
                  where: { id: existing.id },
                  data: { port: envPort, isRemote: false, isActive: i === 0 }
                });
              } else {
                await prisma.tallyConfiguration.create({
                  data: {
                    host: envHost,
                    port: envPort,
                    companyName,
                    isRemote: false,
                    isActive: i === 0
                  }
                });
              }
            }
            console.log('[CONFIG] Successfully seeded discovered Tally companies to database.');
            return;
          }
        } catch (fetchErr: any) {
          console.warn(`[CONFIG] Direct Tally query failed: ${fetchErr.message}. Falling back to default configuration.`);
        }

        // Fallback: If Tally is unreachable, seed/activate placeholder configuration
        const fallbackCompany = process.env.TALLY_COMPANY_NAME || 'Default Company';
        
        await prisma.tallyConfiguration.updateMany({
          where: { isActive: true },
          data: { isActive: false }
        });

        const existingFallback = await prisma.tallyConfiguration.findFirst({
          where: { host: envHost, companyName: fallbackCompany }
        });

        if (existingFallback) {
          await prisma.tallyConfiguration.update({
            where: { id: existingFallback.id },
            data: { port: envPort, isRemote: false, isActive: true }
          });
        } else {
          await prisma.tallyConfiguration.create({
            data: {
              host: envHost,
              port: envPort,
              companyName: fallbackCompany,
              isRemote: false,
              isActive: true
            }
          });
        }
        console.log(`[CONFIG] Fallback configuration seeded for: "${fallbackCompany}".`);
      }
    } catch (err: any) {
      console.error('[CONFIG] Failed to sync config from environment variables:', err.message);
    }
  }
}

server.listen(PORT, async () => {
  console.log(`Backend service running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
    await syncConfigFromEnv();
    startAutoSync();
  }
});

export default app;