import { prisma } from './prisma';
import { TallyDataFetcher } from './tally-fetcher';

export async function syncConfigFromEnv() {
  const envHost = process.env.TALLY_HOST;
  const envPort = process.env.TALLY_PORT ? parseInt(process.env.TALLY_PORT) : 9000;
  const envIsRemote = process.env.TALLY_IS_REMOTE === 'true';
  const envGatewayId = process.env.TALLY_GATEWAY_ID || null;

  if (!envHost) return;

  const existingActive = await prisma.tallyConfiguration.findFirst({ where: { isActive: true } });
  if (existingActive) return;

  console.log('[AUTO-CONFIG] Syncing Tally configuration from environment variables...');

  try {
    if (envIsRemote) {
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
            gatewayId: envGatewayId || '',
            isActive: false
          }
        });
      }
      console.log('[AUTO-CONFIG] Remote gateway config registered. Awaiting connection.');
    } else {
      try {
        console.log(`[AUTO-CONFIG] Auto-discovering companies from Tally at http://${envHost}:${envPort}...`);
        const fetcher = new TallyDataFetcher({ host: envHost, port: envPort, isRemote: false });
        const parsed = await fetcher.fetchReport('CompanyInfo');
        const companiesList = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.[0]?.COMPANY || [];
        const companyNames: string[] = companiesList.map((c: any) =>
          typeof c.NAME === 'object' ? c.NAME['#text'] : c.NAME
        ).filter(Boolean);

        if (companyNames.length > 0) {
          console.log(`[AUTO-CONFIG] Discovered ${companyNames.length} companies: ${companyNames.join(', ')}`);
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
                data: { host: envHost, port: envPort, companyName, isRemote: false, isActive: i === 0 }
              });
            }
          }
          console.log('[AUTO-CONFIG] Successfully seeded discovered companies.');
          return;
        }
      } catch (fetchErr: any) {
        console.warn(`[AUTO-CONFIG] Direct Tally query failed: ${fetchErr.message}. Using fallback.`);
      }

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
          data: { host: envHost, port: envPort, companyName: fallbackCompany, isRemote: false, isActive: true }
        });
      }
      console.log(`[AUTO-CONFIG] Fallback config seeded for: "${fallbackCompany}".`);
    }
  } catch (err: any) {
    console.error('[AUTO-CONFIG] Failed:', err.message);
  }
}
