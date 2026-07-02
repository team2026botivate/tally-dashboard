"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SyncStatus {
  lastSync: {
    id: string;
    syncType: string;
    status: string;
    recordsProcessed: number;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  lastSyncTime: string | null;
  isConfigured: boolean;
}

interface SyncLog {
  id: string;
  syncType: string;
  status: string;
  recordsProcessed: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync", "status"],
    queryFn: () => fetchJson<SyncStatus>("/api/tally/sync/status"),
  });
}

export function useSyncLogs() {
  return useQuery({
    queryKey: ["sync", "logs"],
    queryFn: () => fetchJson<SyncLog[]>("/api/tally/sync-log"),
    select: (data) => data ?? [],
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tally/ping");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Tally connected on ${data.host}:${data.port}`);
    },
    onError: () => {
      toast.error("Tally not reachable — is it open on port 9000?");
    },
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (type: string) => {
      const path = type === "full" ? "/api/tally/sync/full" : `/api/tally/sync/${type}`;
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `${type} sync failed`);
      }
      return type;
    },
    onSuccess: (type) => {
      toast.success(`${type} sync started`);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["sync"] });
      }, 3000);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
