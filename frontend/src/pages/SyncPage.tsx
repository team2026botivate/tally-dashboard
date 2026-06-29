import { useState, useEffect } from "react"
import { toast } from "sonner"
import api from "@/lib/api"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

interface SyncStatus {
  lastSync: {
    id: string
    syncType: string
    status: string
    recordsProcessed: number
    startedAt: string
    completedAt: string | null
    errorMessage: string | null
  } | null
  lastSyncTime: string | null
  isConfigured: boolean
}

interface SyncLog {
  id: string
  syncType: string
  status: string
  recordsProcessed: number
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
}

export function SyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [connection, setConnection] = useState<boolean | null>(null)
  const [connectionLoading, setConnectionLoading] = useState(false)

  function loadStatus() {
    api.get("/tally/sync/status")
      .then((res) => setStatus(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function loadLogs() {
    api.get("/tally/sync-log")
      .then((res) => setLogs(res.data || []))
      .catch(() => {})
  }

  useEffect(() => {
    loadStatus()
    loadLogs()
  }, [])

  async function handleTestConnection() {
    setConnectionLoading(true)
    setConnection(null)
    try {
      const res = await api.get("/tally/ping")
      setConnection(true)
      toast.success("Tally connected on " + res.data.host + ":" + res.data.port)
    } catch {
      setConnection(false)
      toast.error("Tally not reachable — is it open on port 9000?")
    }
    setConnectionLoading(false)
  }

  async function handleSync(type: string) {
    setSyncing(type)
    try {
      const path = type === "full" ? "/tally/sync/full" : `/tally/sync/${type}`
      await api.post(path)
      toast.success(`${type} sync started`)
      setTimeout(() => { loadStatus(); loadLogs() }, 3000)
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
    setSyncing(null)
  }

  function statusBadge(s: string) {
    const map: Record<string, string> = {
      COMPLETED: "bg-green-100 text-green-800",
      IN_PROGRESS: "bg-blue-100 text-blue-800",
      FAILED: "bg-red-100 text-red-800",
      PENDING: "bg-yellow-100 text-yellow-800",
    }
    return map[s] || "bg-gray-100 text-gray-800"
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 pt-4">
          <Card className="mx-4 lg:mx-6">
            <CardHeader>
              <CardTitle>Sync Management</CardTitle>
              <CardDescription>Synchronize data from Tally ERP</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Status bar */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      Configured:{" "}
                      <Badge variant={status?.isConfigured ? "default" : "outline"}>
                        {status?.isConfigured ? "Yes" : "No"}
                      </Badge>
                    </span>
                    {status?.lastSyncTime && (
                      <span className="text-sm text-muted-foreground">
                        Last sync: {new Date(status.lastSyncTime).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>

                  {/* Connection test */}
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={connectionLoading}>
                      {connectionLoading ? "Testing..." : "Test Connection"}
                    </Button>
                    {connection === true && <span className="text-green-600 text-sm font-medium">Tally Connected</span>}
                    {connection === false && <span className="text-red-500 text-sm font-medium">Tally Not Reachable</span>}
                  </div>

                  {/* Sync buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => handleSync("full")} disabled={syncing !== null || !status?.isConfigured}>
                      {syncing === "full" ? "Syncing..." : "Full Sync"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleSync("ledgers")} disabled={syncing !== null || !status?.isConfigured}>
                      {syncing === "ledgers" ? "Syncing..." : "Sync Ledgers"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleSync("vouchers")} disabled={syncing !== null || !status?.isConfigured}>
                      {syncing === "vouchers" ? "Syncing..." : "Sync Vouchers"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleSync("stock")} disabled={syncing !== null || !status?.isConfigured}>
                      {syncing === "stock" ? "Syncing..." : "Sync Stock"}
                    </Button>
                    <Button variant="outline" onClick={() => { loadStatus(); loadLogs() }}>
                      Refresh
                    </Button>
                  </div>

                  {/* Last sync detail */}
                  {status?.lastSync && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Latest Sync</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Records</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead>Completed</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>{status.lastSync.syncType}</TableCell>
                            <TableCell>
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(status.lastSync.status)}`}>
                                {status.lastSync.status}
                              </span>
                            </TableCell>
                            <TableCell>{status.lastSync.recordsProcessed}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(status.lastSync.startedAt).toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {status.lastSync.completedAt ? new Date(status.lastSync.completedAt).toLocaleString("en-IN") : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {status.lastSync.errorMessage || "-"}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Sync log history */}
                  {logs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Sync History (last {logs.length})</h3>
                      <div className="max-h-64 overflow-y-auto border rounded">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Records</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead>Error</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {logs.map((log) => (
                              <TableRow key={log.id}>
                                <TableCell>{log.syncType}</TableCell>
                                <TableCell>
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(log.status)}`}>
                                    {log.status}
                                  </span>
                                </TableCell>
                                <TableCell>{log.recordsProcessed}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {new Date(log.startedAt).toLocaleString("en-IN")}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-40 truncate">
                                  {log.errorMessage || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
