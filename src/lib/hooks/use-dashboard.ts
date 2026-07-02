"use client";

import { useQuery } from "@tanstack/react-query";

interface BalanceRow {
  category: string;
  balance: number;
}

interface LedgerRow {
  name: string;
  groupName: string;
  openingBalance: string;
  currentBalance: string;
}

interface VoucherRow {
  voucherNumber: string;
  voucherDate: string;
  narration: string | null;
  totalAmount: string;
  voucherType: { name: string };
}

interface TrendRow {
  date: string;
  voucher_type: string;
  count: number;
  total_amount: string;
}

interface StockRow {
  name: string;
  unit: string;
  openingQty: string;
  closingQty: string;
  closingValue: string;
  stockGroup: { name: string };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useBalanceSheet(companyId?: string) {
  return useQuery({
    queryKey: ["dashboard", "balance-sheet", companyId],
    queryFn: () => fetchJson<BalanceRow[]>(`/api/dashboard/balance-sheet?companyId=${companyId}`),
    enabled: !!companyId,
  });
}

export function useTrialBalance(companyId?: string) {
  return useQuery({
    queryKey: ["dashboard", "trial-balance", companyId],
    queryFn: () => fetchJson<LedgerRow[]>(`/api/dashboard/trial-balance?companyId=${companyId}`),
    enabled: !!companyId,
  });
}

export function useRecentVouchers(companyId?: string, limit = 50) {
  return useQuery({
    queryKey: ["dashboard", "recent-vouchers", companyId, limit],
    queryFn: () => fetchJson<VoucherRow[]>(`/api/dashboard/recent-vouchers?limit=${limit}&companyId=${companyId}`),
    enabled: !!companyId,
    select: (data) => data ?? [],
  });
}

export function useVoucherTrends(companyId?: string, days = 30) {
  return useQuery({
    queryKey: ["dashboard", "voucher-trends", companyId, days],
    queryFn: () => fetchJson<TrendRow[]>(`/api/dashboard/voucher-trends?days=${days}&companyId=${companyId}`),
    enabled: !!companyId,
  });
}

export function useTopLedgers(companyId?: string, limit = 5) {
  return useQuery({
    queryKey: ["dashboard", "top-ledgers", companyId, limit],
    queryFn: () => fetchJson<LedgerRow[]>(`/api/dashboard/top-ledgers?limit=${limit}&companyId=${companyId}`),
    enabled: !!companyId,
  });
}

export function useStockSummary(companyId?: string) {
  return useQuery({
    queryKey: ["dashboard", "stock-summary", companyId],
    queryFn: () => fetchJson<StockRow[]>(`/api/dashboard/stock-summary?companyId=${companyId}`),
    enabled: !!companyId,
  });
}

export function useDashboardCards(companyId?: string) {
  const bs = useBalanceSheet(companyId);
  const tb = useTrialBalance(companyId);
  const rv = useRecentVouchers(companyId, 1000);

  const isLoading = bs.isLoading || tb.isLoading || rv.isLoading;

  const assets = bs.data?.find((r) => r.category === "Assets")?.balance ?? 0;
  const liabilities = bs.data?.find((r) => r.category === "Liabilities")?.balance ?? 0;
  const ledgerCount = tb.data?.length ?? 0;
  const voucherCount = rv.data?.length ?? 0;

  return { assets, liabilities, ledgerCount, voucherCount, isLoading };
}

export function useChartData(companyId?: string) {
  const { data, isLoading } = useVoucherTrends(companyId);

  if (!data) return { chartData: [], isLoading };

  const byDate: Record<string, { date: string; total: number }> = {};
  for (const row of data) {
    if (!byDate[row.date]) byDate[row.date] = { date: row.date, total: 0 };
    byDate[row.date].total += Number(row.total_amount) || 0;
  }
  const chartData = Object.values(byDate).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return { chartData, isLoading };
}
