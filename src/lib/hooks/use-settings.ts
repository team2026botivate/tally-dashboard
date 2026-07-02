"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface User {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  profilePicture: string | null;
  isActive: boolean;
  pageAccess: string[] | null;
  role: "ADMIN" | "VIEWER";
  createdAt: string;
}

interface TallyConfig {
  host: string;
  port: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => fetchJson<User[]>("/api/users"),
    select: (data) => data ?? [],
  });
}

export function useTallyConfig() {
  return useQuery({
    queryKey: ["tally-config"],
    queryFn: () => fetchJson<TallyConfig | null>("/api/config"),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useTestTallyConnection() {
  return useMutation({
    mutationFn: async (config: TallyConfig) => {
      const res = await fetch("/api/tally/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Tally connected on ${vars.host}:${vars.port}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
export function useSaveTallyConfig(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: TallyConfig & { syncInterval?: number }) => {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, syncInterval: config.syncInterval ?? 600000 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save configuration");
      return data;
    },
    onSuccess: (data) => {
      if (data.discovered) {
        toast.success(`Tally configuration saved — ${data.companies?.length ?? 0} compan${data.companies?.length === 1 ? 'y' : 'ies'} found`);
      } else {
        toast.success('Configuration saved. Tally is not reachable from this server.');
        toast.info('To sync data, the Tally Agent must run on your local machine.');
      }
      queryClient.invalidateQueries({ queryKey: ["tally-config"] });
      queryClient.invalidateQueries({ queryKey: ["sync"] });
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
