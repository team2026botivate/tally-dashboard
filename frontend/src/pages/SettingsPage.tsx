import { useState, useEffect } from "react"
import { toast } from "sonner"
import api from "@/lib/api"
import { useCompany } from "@/lib/company"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Settings2Icon, UserIcon, PlayIcon, DatabaseIcon, FileTextIcon, RefreshCwIcon } from "lucide-react"

interface User {
  id: string
  username: string
  name: string | null
  email: string | null
  phoneNumber: string | null
  profilePicture: string | null
  isActive: boolean
  pageAccess: string[] | null
  role: "ADMIN" | "VIEWER"
  createdAt: string
}

const PAGE_OPTIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "companies", label: "Companies" },
  { id: "company-data", label: "Company Data" },
  { id: "settings", label: "Settings" },
]

export function SettingsPage() {
  const { refreshCompanies } = useCompany()
  const [users, setUsers] = useState<User[]>([])
  const [syncing, setSyncing] = useState<string | null>(null)

  // Tally config form
  const [tallyHost, setTallyHost] = useState("localhost")
  const [tallyPort, setTallyPort] = useState("9000")
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  function loadUsers() {
    api.get("/users").then((res) => setUsers(res.data)).catch(() => toast.error("Failed to load users"))
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

  async function handleTestConnection() {
    setTesting(true)
    try {
      await api.post("/tally/test-connection", {
        host: tallyHost,
        port: Number(tallyPort)
      })
      toast.success("Tally connected on " + tallyHost + ":" + tallyPort)
    } catch {
      toast.error("Tally not reachable on " + tallyHost + ":" + tallyPort)
    }
    setTesting(false)
  }

  async function handleSaveConfig() {
    try {
      const res = await api.post("/config", {
        host: tallyHost,
        port: Number(tallyPort),
        syncInterval: 600000
      })
      refreshCompanies()
      toast.success("Tally configuration saved — " + (res.data.companies?.length || 0) + " companies found")
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save configuration")
    }
  }

  async function handleSync(type: string) {
    setSyncing(type)
    try {
      const path = type === "full" ? "/tally/sync/full" : `/tally/sync/${type}`
      await api.post(path)
      toast.success(`${type} sync started`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
    setSyncing(null)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 pt-4">
          <Tabs defaultValue="tally" className="mx-4 lg:mx-6">
            <TabsList>
              <TabsTrigger value="tally" className="flex items-center gap-2">
                <Settings2Icon className="size-4" />
                Tally Configuration
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <UserIcon className="size-4" />
                Manage Users
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tally" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tally Configuration</CardTitle>
                  <CardDescription>Connect to Tally ERP by providing the host and port</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="host">Host</Label>
                      <Input id="host" value={tallyHost} onChange={(e) => setTallyHost(e.target.value)} placeholder="localhost" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input id="port" value={tallyPort} onChange={(e) => setTallyPort(e.target.value)} placeholder="9000" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleTestConnection} disabled={testing}>
                      {testing ? "Testing..." : "Test Connection"}
                    </Button>
                    <Button onClick={handleSaveConfig}>
                      Save Configuration
                    </Button>
                  </div>

                  <Separator className="my-2" />

                  {/* Sync controls */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Sync Management</h3>

                    {/* Sync buttons */}
                    <div className="flex gap-2 flex-wrap mb-3">
                      <Button onClick={() => handleSync("full")} disabled={syncing !== null}>
                        {syncing === "full" ? "Syncing..." : "Full Sync"}
                      </Button>
                      <Button variant="secondary" onClick={() => handleSync("ledgers")} disabled={syncing !== null}>
                        {syncing === "ledgers" ? "Syncing..." : "Sync Ledgers"}
                      </Button>
                      <Button variant="secondary" onClick={() => handleSync("vouchers")} disabled={syncing !== null}>
                        {syncing === "vouchers" ? "Syncing..." : "Sync Vouchers"}
                      </Button>
                      <Button variant="secondary" onClick={() => handleSync("stock")} disabled={syncing !== null}>
                        {syncing === "stock" ? "Syncing..." : "Sync Stock"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Manage Users</CardTitle>
                </CardHeader>
                <CardContent>
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>{user.name || "-"}</TableCell>
                            <TableCell>{user.email || "-"}</TableCell>
                            <TableCell>{user.role}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
