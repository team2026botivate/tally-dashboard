import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import api from './api';

interface TallyCompany {
  id: string
  companyName: string
}

interface TallyConfig {
  id: string
  companyName: string
  host: string
  port: number
  isActive: boolean
  lastSyncAt: string | null
}

interface CompanyContextType {
  companies: TallyCompany[]
  activeCompany: TallyConfig | null
  loading: boolean
  switchCompany: (companyName: string) => Promise<void>
  refreshCompanies: () => void
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<TallyCompany[]>([]);
  const [activeCompany, setActiveCompany] = useState<TallyConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch list of companies from Tally, falling back to DB configs
  const refreshCompanies = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // First, try to fetch companies live from Tally
    api.get('/tally/companies')
      .then((res) => setCompanies(res.data))
      .catch(() => {
        // If /tally/companies fails (e.g., 404 when no active config),
        // fallback to showing companies from DB configs (if any)
        api.get('/config/all')
          .then((res) => {
            const configs = res.data || [];
            setCompanies(configs.map((c: any, i: number) => ({
              id: c.id || `cfg-${i}`,
              companyName: c.companyName
            })));
          })
          .catch(() => {
            // If /config/all also fails, clear the companies list
            setCompanies([]);
          });
      })
      .finally(() => {
        // Still try to load the active config (needed for switching company)
        api.get('/config')
          .then((res) => setActiveCompany(res.data || null))
          .catch(() => setActiveCompany(null))
          .finally(() => setLoading(false));
      });
  }, []);

  useEffect(() => {
    refreshCompanies();
  }, [refreshCompanies]);

  const switchCompany = useCallback(async (companyName: string) => {
    try {
      const res = await api.get('/config/all');
      const existing = res.data.find((c: TallyConfig) => c.companyName === companyName);

      if (existing) {
        await api.post(`/config/${existing.id}/activate`);
        await api.post(`/tally/sync/${existing.id}`);
      } else {
        // No config exists yet for this company — seed from the active config's host/port
        const active = await api.get('/config');
        const cfg = active.data;
        if (!cfg) throw new Error('No active Tally configuration');

        // This creates configs for ALL companies found on Tally at that host:port
        await api.post('/config', {
          host: cfg.host,
          port: cfg.port,
        });

        // Now find the newly created config for the target company and activate it
        const allRes = await api.get('/config/all');
        const target = allRes.data.find((c: TallyConfig) => c.companyName === companyName);
        if (target) {
          await api.post(`/config/${target.id}/activate`);
          await api.post(`/tally/sync/${target.id}`);
        } else {
          throw new Error('Company ' + companyName + ' not found on Tally');
        }
      }
      refreshCompanies();
      toast.success('Switched to ' + companyName);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to switch company');
    }
  }, [refreshCompanies]);

  return (
    <CompanyContext.Provider value={{ companies, activeCompany, loading, switchCompany, refreshCompanies }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within a CompanyProvider');
  return context;
}
