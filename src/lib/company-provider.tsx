"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { toast } from "sonner";

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

  const refreshCompanies = useCallback(async () => {
    setLoading(true);

    const [companiesResult, configResult] = await Promise.allSettled([
      fetch("/api/tally/companies").then(r => r.ok ? r.json() : []),
      fetch("/api/config").then(r => r.ok ? r.json() : null),
    ]);

    if (companiesResult.status === 'fulfilled' && Array.isArray(companiesResult.value) && companiesResult.value.length > 0) {
      setCompanies(companiesResult.value);
    } else {
      try {
        const allRes = await fetch("/api/config/all");
        const data = await allRes.json();
        const configs = data || [];
        setCompanies(configs.map((c: any, i: number) => ({
          id: c.id || `cfg-${i}`,
          companyName: c.companyName
        })));
      } catch {
        setCompanies([]);
      }
    }

    setActiveCompany(configResult.status === 'fulfilled' ? configResult.value : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshCompanies();
  }, [refreshCompanies]);

  const switchCompany = useCallback(async (companyName: string) => {
    try {
      const allRes = await fetch("/api/config/all");
      const allConfigs = await allRes.json();
      const existing = allConfigs.find((c: TallyConfig) => c.companyName === companyName);

      if (existing) {
        await fetch(`/api/config/${existing.id}/activate`, { method: "POST" });
        await fetch(`/api/tally/sync/${existing.id}`, { method: "POST" });
      } else {
        const activeRes = await fetch("/api/config");
        const cfg = await activeRes.json();
        if (!cfg) throw new Error("No active Tally configuration");

        const createRes = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: cfg.host, port: cfg.port }),
        });
        const createData = await createRes.json();

        const allRes2 = await fetch("/api/config/all");
        const allConfigs2 = await allRes2.json();
        const target = allConfigs2.find((c: TallyConfig) => c.companyName === companyName);
        if (target) {
          await fetch(`/api/config/${target.id}/activate`, { method: "POST" });
          await fetch(`/api/tally/sync/${target.id}`, { method: "POST" });
        } else {
          throw new Error("Company " + companyName + " not found on Tally");
        }
      }
      refreshCompanies();
      toast.success("Switched to " + companyName);
    } catch (err: any) {
      toast.error(err.message || "Failed to switch company");
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
  if (!context) throw new Error("useCompany must be used within a CompanyProvider");
  return context;
}
