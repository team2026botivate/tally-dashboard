"use client";

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useCompany } from "@/lib/company-provider"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarInset } from "@/components/ui/sidebar"
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

export default function SettingsPage() {
  const { refreshCompanies } = useCompany()
  const [users, setUsers] = useState<User[]>([])
  const [syncing, setSyncing] = useState<string | null>(null)

  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<Partial<User> & { password?: string }>({})
  const [savingUser, setSavingUser] = useState(false)

  const [tallyHost, setTallyHost] = useState("localhost")
  const [tallyPort, setTallyPort] = useState("9000")
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  function loadUsers() {
    fetch("/api/users").then((res) => res.ok ? res.json().then(setUsers) : null).catch(() => toast.error("Failed to load users"))
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

  function openEditSheet(user: User) {
    setEditingUser(user)
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      role: user.role,
      pageAccess: user.pageAccess || [],
      isActive: user.isActive,
      password: ""
    })
  }

  async function handleSaveUser() {
    if (!editingUser) return
    setSavingUser(true)
    try {
      const payload = { ...editForm }
      if (!payload.password) delete payload.password
      await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      toast.success("User updated successfully")
      setEditingUser(null)
      loadUsers()
    } catch (err: any) {
      toast.error(err.message || "Failed to update user")
    }
    setSavingUser(false)
  }

  async function handleTestConnection() {
    setTesting(true)
    try {
      const res = await fetch("/api/tally/test-connection", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: tallyHost, port: Number(tallyPort) }),
      })
      if (res.ok) {
        toast.success("Tally connected on " + tallyHost + ":" + tallyPort)
      } else {
        toast.error("Tally not reachable on " + tallyHost + ":" + tallyPort)
      }
    } catch {
      toast.error("Tally not reachable on " + tallyHost + ":" + tallyPort)
    }
    setTesting(false)
  }

  async function handleSaveConfig() {
    try {
      const res = await fetch("/api/config", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: tallyHost, port: Number(tallyPort), syncInterval: 600000 }),
      })
      const data = await res.json()
      refreshCompanies()
      toast.success("Tally configuration saved — " + (data.companies?.length || 0) + " companies found")
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration")
    }
  }

  async function handleSync(type: string) {
    setSyncing(type)
    try {
      const path = type === "full" ? "/api/tally/sync/full" : `/api/tally/sync/${type}`
      await fetch(path, { method: 'POST' })
      toast.success(`${type} sync started`)
    } catch (err: any) {
      toast.error(err.message)
    }
    setSyncing(null)
  }

  return (
    <>
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

                  <div>
                    <h3 className="text-sm font-semibold mb-3">Sync Management</h3>
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
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>{user.name || "-"}</TableCell>
                            <TableCell>{user.email || "-"}</TableCell>
                            <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => openEditSheet(user)}>
                                Edit
                              </Button>
                            </TableCell>
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

        <Sheet open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Edit User</SheetTitle>
              <SheetDescription>Make changes to the user's profile.</SheetDescription>
            </SheetHeader>
            {editingUser && (
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={editForm.phoneNumber || ""} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" placeholder="Leave blank to keep current" value={editForm.password || ""} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "ADMIN" | "VIEWER" })}
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editForm.isActive || false}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="isActive" className="font-normal cursor-pointer">
                    Account is Active
                  </Label>
                </div>

                {editForm.role !== "ADMIN" && (
                  <div className="space-y-3 pt-2">
                    <Label>Page Access</Label>
                    <div className="grid gap-3 border rounded-md p-4">
                      {PAGE_OPTIONS.map((opt) => {
                        const hasAccess = editForm.pageAccess?.includes(opt.id)
                        return (
                          <div key={opt.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                            <Label className="font-medium">
                              {opt.label}
                            </Label>
                            {hasAccess ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  const current = editForm.pageAccess || []
                                  setEditForm({ ...editForm, pageAccess: current.filter(id => id !== opt.id) })
                                }}
                              >
                                Revoke Access
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const current = editForm.pageAccess || []
                                  setEditForm({ ...editForm, pageAccess: [...current, opt.id] })
                                }}
                              >
                                Provide Access
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Select which pages this user can view.</p>
                  </div>
                )}
              </div>
            )}
            <SheetFooter>
              <Button disabled={savingUser} onClick={handleSaveUser}>
                {savingUser ? "Saving..." : "Save changes"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </SidebarInset>
    </>
  )
}
