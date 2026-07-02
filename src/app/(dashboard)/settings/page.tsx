"use client";

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCompany } from "@/lib/company-provider"
import {
  useUsers,
  useUpdateUser,
  useTestTallyConnection,
  useSaveTallyConfig,
  useCreateUser,
} from "@/lib/hooks/use-settings"
import { useTriggerSync, useTriggerSyncAll, useSyncStatus, useSyncLogs } from "@/lib/hooks/use-sync"
import { tallyConfigSchema, editUserSchema, createUserSchema, type TallyConfigValues, type EditUserValues, type CreateUserValues } from "@/lib/schemas"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarInset } from "@/components/ui/sidebar"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldError,
} from "@/components/ui/field"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import {
  Settings2Icon,
  UserIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  RefreshCwIcon,
  DatabaseIcon,
  FileTextIcon,
  FileChartColumnIcon,
  Loader2Icon,
  HistoryIcon,
  ActivityIcon,
  PlusIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react"
import { toast } from "sonner"

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

const SYNC_ACTIONS = [
  { key: "full", label: "Full Sync", icon: RefreshCwIcon },
  { key: "ledgers", label: "Ledgers", icon: DatabaseIcon },
  { key: "vouchers", label: "Vouchers", icon: FileTextIcon },
  { key: "stock", label: "Stock", icon: FileChartColumnIcon },
]

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  COMPLETED: { variant: "default", label: "Completed" },
  IN_PROGRESS: { variant: "secondary", label: "In Progress" },
  FAILED: { variant: "destructive", label: "Failed" },
  PENDING: { variant: "outline", label: "Pending" },
}

function statusBadge(status: string) {
  const cfg = statusConfig[status] || { variant: "outline" as const, label: status }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export default function SettingsPage() {
  const { refreshCompanies } = useCompany()
  const { data: users = [], isLoading: usersLoading } = useUsers()
  const updateUser = useUpdateUser()
  const createUser = useCreateUser()
  const testTallyConn = useTestTallyConnection()
  const saveConfig = useSaveTallyConfig(() => {
    refreshCompanies()
    handleSync("full")
  })
  const triggerSync = useTriggerSync()
  const triggerSyncAll = useTriggerSyncAll()
  
  const { data: syncStatus, isLoading: statusLoading } = useSyncStatus()
  const { data: logs = [], isLoading: logsLoading } = useSyncLogs()
  const isInProgress = syncStatus?.lastSync?.status === "IN_PROGRESS"

  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editFormValues, setEditFormValues] = useState<EditUserValues>({
    username: "",
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    role: "VIEWER",
    isActive: true,
    pageAccess: [],
  })

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createFormValues, setCreateFormValues] = useState<CreateUserValues>({
    username: "",
    password: "",
    name: "",
    email: "",
    phoneNumber: "",
    role: "VIEWER",
    isActive: true,
    pageAccess: [],
  })

  const [showEditPassword, setShowEditPassword] = useState(false)
  const [showCreatePassword, setShowCreatePassword] = useState(false)

  const configForm = useForm<TallyConfigValues>({
    resolver: zodResolver(tallyConfigSchema),
    defaultValues: { host: "localhost", port: 9000 },
  })

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.ok ? res.json() : null)
      .then((cfg) => {
        if (cfg) {
          configForm.reset({ host: cfg.host || "localhost", port: Number(cfg.port) || 9000 })
        }
      })
      .catch(() => {})
  }, [])

  function openEditSheet(user: User) {
    setEditingUser(user)
    setShowEditPassword(false)
    setEditFormValues({
      username: user.username,
      name: user.name || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      password: "",
      role: user.role,
      isActive: user.isActive,
      pageAccess: user.pageAccess || [],
    })
  }

  function handleSaveUser() {
    if (!editingUser) return
    const payload = { ...editFormValues }
    if (!payload.password) delete (payload as any).password

    const result = editUserSchema.safeParse(payload)
    if (!result.success) {
      const errorMsg = result.error.issues[0].message
      toast.error(errorMsg)
      return
    }

    updateUser.mutate(
      { id: editingUser.id, ...payload },
      { onSuccess: () => setEditingUser(null) }
    )
  }

  function handleCreateUser() {
    const result = createUserSchema.safeParse(createFormValues)
    if (!result.success) {
      const errorMsg = result.error.issues[0].message
      toast.error(errorMsg)
      return
    }

    createUser.mutate(createFormValues, {
      onSuccess: () => {
        setCreateDialogOpen(false)
        setShowCreatePassword(false)
        setCreateFormValues({
          username: "",
          password: "",
          name: "",
          email: "",
          phoneNumber: "",
          role: "VIEWER",
          isActive: true,
          pageAccess: [],
        })
      }
    })
  }

  function handleSync(type: string) {
    triggerSync.mutate(type)
  }

  return (
    <>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="@container/main flex flex-1 flex-col py-4 md:py-6">
          <div className="px-4 lg:px-6 mb-2">
            <div className="flex items-center gap-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Settings2Icon className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold md:text-2xl">Settings</h1>
                <p className="text-sm text-muted-foreground">Manage Tally connection and user accounts</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="tally" className="px-4 lg:px-6">
            <TabsList>
              <TabsTrigger value="tally">Tally Connection</TabsTrigger>
              <TabsTrigger value="users">Manage Users</TabsTrigger>
            </TabsList>

            <TabsContent value="tally" className="mt-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold mb-1">Connection Details</h3>
                  <p className="text-sm text-muted-foreground mb-4">Configure how this dashboard connects to your Tally ERP instance</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field orientation="vertical">
                    <FieldLabel htmlFor="host">Host</FieldLabel>
                    <FieldContent>
                      <Input
                        id="host"
                        placeholder="localhost"
                        {...configForm.register("host")}
                      />
                      <FieldError errors={[configForm.formState.errors.host]} />
                    </FieldContent>
                  </Field>
                  <Field orientation="vertical">
                    <FieldLabel htmlFor="port">Port</FieldLabel>
                    <FieldContent>
                      <Input
                        id="port"
                        type="number"
                        placeholder="9000"
                        {...configForm.register("port", { valueAsNumber: true })}
                      />
                      <FieldError errors={[configForm.formState.errors.port]} />
                    </FieldContent>
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={configForm.handleSubmit((v) => testTallyConn.mutate(v))}
                    disabled={testTallyConn.isPending}
                  >
                    {testTallyConn.isPending && (
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    variant="outline"
                    onClick={configForm.handleSubmit((v) => saveConfig.mutate(v))}
                    disabled={saveConfig.isPending}
                  >
                    {saveConfig.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </div>

                {testTallyConn.isSuccess && (
                  <Alert variant="default" className="border-green-500/40 bg-green-50/40 dark:bg-transparent text-green-800 dark:text-green-400">
                    <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400" />
                    <AlertTitle>Connection successful</AlertTitle>
                    <AlertDescription>
                      Tally ERP responded successfully at {configForm.watch("host")}:{configForm.watch("port")}
                    </AlertDescription>
                  </Alert>
                )}

                {testTallyConn.isError && (
                  <Alert variant="destructive">
                    <AlertTriangleIcon className="size-4" />
                    <AlertTitle>Connection failed</AlertTitle>
                    <AlertDescription>
                      {testTallyConn.error?.message || "Could not reach Tally ERP. Check the host and port."}
                    </AlertDescription>
                  </Alert>
                )}

                {saveConfig.isSuccess && (
                  <Alert variant="default" className="border-green-500/40 bg-green-50/40 dark:bg-transparent text-green-800 dark:text-green-400">
                    <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400" />
                    <AlertTitle>Configuration saved</AlertTitle>
                    <AlertDescription>Connection details have been updated successfully.</AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-semibold mb-1">Sync Management</h3>
                    <p className="text-sm text-muted-foreground">Synchronize data and view operation history from Tally ERP</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {syncStatus?.lastSyncTime && (
                      <span className="text-sm text-muted-foreground">
                        Last sync: {new Date(syncStatus.lastSyncTime).toLocaleString("en-IN")}
                      </span>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <HistoryIcon className="mr-2 size-4" />
                          Sync History
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Sync History</DialogTitle>
                          <DialogDescription>View all sync operations</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-96">
                          {logsLoading ? (
                            <div className="space-y-2 p-4">
                              <Skeleton className="h-8 w-full" />
                              <Skeleton className="h-8 w-full" />
                            </div>
                          ) : logs.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-4">No sync history available.</p>
                          ) : (
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
                                    <TableCell className="font-medium">{log.syncType}</TableCell>
                                    <TableCell>{statusBadge(log.status)}</TableCell>
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
                          )}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {statusLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* In Progress Status Bar */}
                    {isInProgress && (
                      <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Loader2Icon className="size-4 animate-spin text-primary" />
                          Synchronization in progress...
                        </div>
                        <Progress value={45} className="h-1.5" />
                      </div>
                    )}

                    {/* Manual Sync Trigger Grid */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {SYNC_ACTIONS.map(({ key, label, icon: Icon }) => (
                        <Button
                          key={key}
                          variant="outline"
                          className="flex-col h-auto gap-2 py-4"
                          onClick={() => handleSync(key)}
                          disabled={triggerSync.isPending || !syncStatus?.isConfigured}
                        >
                          {triggerSync.isPending && triggerSync.variables === key ? (
                            <Loader2Icon className="size-5 animate-spin" />
                          ) : (
                            <Icon className="size-5" />
                          )}
                          <span className="text-xs font-normal">{label}</span>
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="default"
                      className="w-full gap-2"
                      onClick={() => triggerSyncAll.mutate()}
                      disabled={triggerSyncAll.isPending || !syncStatus?.isConfigured}
                    >
                      {triggerSyncAll.isPending ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <RefreshCwIcon className="size-4" />
                      )}
                      {triggerSyncAll.isPending ? "Syncing all companies..." : "Sync All Companies"}
                    </Button>

                    {/* Latest Sync Table */}
                    {syncStatus?.lastSync && (
                      <div className="pt-2">
                        <h4 className="text-sm font-semibold mb-2">Latest Operation</h4>
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
                              <TableCell className="font-medium">{syncStatus.lastSync.syncType}</TableCell>
                              <TableCell>{statusBadge(syncStatus.lastSync.status)}</TableCell>
                              <TableCell>{syncStatus.lastSync.recordsProcessed}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(syncStatus.lastSync.startedAt).toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {syncStatus.lastSync.completedAt ? new Date(syncStatus.lastSync.completedAt).toLocaleString("en-IN") : "-"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                                {syncStatus.lastSync.errorMessage || "-"}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <div>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-semibold mb-1">Manage Users</h3>
                    <p className="text-sm text-muted-foreground">View and edit user accounts</p>
                  </div>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <PlusIcon className="mr-2 size-4" />
                    Add User
                  </Button>
                </div>
                {usersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="size-9 rounded-full bg-muted animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                          <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <UserIcon className="size-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No users found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Avatar</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Avatar className="size-9">
                              <AvatarFallback className="text-xs">
                                {getInitials(user.name || user.username)}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.name || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>{user.email || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize font-normal">
                              {user.role.toLowerCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.isActive ? (
                              <div className="flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-green-500" />
                                <span className="text-sm">Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="size-1.5 rounded-full bg-muted-foreground" />
                                <span className="text-sm">Inactive</span>
                              </div>
                            )}
                          </TableCell>
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
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-3xl lg:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Make changes to the user's profile and access permissions.</DialogDescription>
            </DialogHeader>
            {editingUser && (
              <ScrollArea className="max-h-[75vh] pr-4">
                <div className="space-y-5 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-11">
                      <AvatarFallback className="text-sm">
                        {getInitials(editingUser.name || editingUser.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{editingUser.username}</p>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(editingUser.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                    {/* Left Column */}
                    <div className="space-y-5">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Profile Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                          <Field orientation="vertical">
                            <FieldLabel>Username</FieldLabel>
                            <FieldContent>
                              <Input
                                value={editFormValues.username}
                                onChange={(e) => setEditFormValues({ ...editFormValues, username: e.target.value })}
                              />
                            </FieldContent>
                          </Field>

                          <Field orientation="vertical">
                            <FieldLabel>Name</FieldLabel>
                            <FieldContent>
                              <Input
                                value={editFormValues.name}
                                onChange={(e) => setEditFormValues({ ...editFormValues, name: e.target.value })}
                              />
                            </FieldContent>
                          </Field>

                          <Field orientation="vertical">
                            <FieldLabel>Email</FieldLabel>
                            <FieldContent>
                              <Input
                                type="email"
                                value={editFormValues.email}
                                onChange={(e) => setEditFormValues({ ...editFormValues, email: e.target.value })}
                              />
                            </FieldContent>
                          </Field>

                          <Field orientation="vertical">
                            <FieldLabel>Phone Number</FieldLabel>
                            <FieldContent>
                              <Input
                                maxLength={10}
                                value={editFormValues.phoneNumber || ""}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "");
                                  setEditFormValues({ ...editFormValues, phoneNumber: val });
                                }}
                                placeholder="10 digit number"
                              />
                            </FieldContent>
                          </Field>

                          <Field orientation="vertical">
                            <FieldLabel>New Password</FieldLabel>
                            <FieldContent>
                              <div className="relative">
                                <Input
                                  type={showEditPassword ? "text" : "password"}
                                  placeholder="Leave blank to keep current"
                                  value={editFormValues.password}
                                  onChange={(e) => setEditFormValues({ ...editFormValues, password: e.target.value })}
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  onClick={() => setShowEditPassword(!showEditPassword)}
                                >
                                  {showEditPassword ? (
                                    <EyeOffIcon className="size-4" />
                                  ) : (
                                    <EyeIcon className="size-4" />
                                  )}
                                </button>
                              </div>
                            </FieldContent>
                          </Field>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-5">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Permissions</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                          <Field orientation="vertical">
                            <FieldLabel>Role</FieldLabel>
                            <FieldContent>
                              <Select
                                value={editFormValues.role}
                                onValueChange={(v) => setEditFormValues({ ...editFormValues, role: v as "ADMIN" | "VIEWER" })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="VIEWER">Viewer</SelectItem>
                                  <SelectItem value="ADMIN">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </FieldContent>
                          </Field>

                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <Label htmlFor="isActive" className="font-medium cursor-pointer">Active Account</Label>
                              <p className="text-xs text-muted-foreground">Allow this user to log in</p>
                            </div>
                            <Switch
                              id="isActive"
                              checked={editFormValues.isActive}
                              onCheckedChange={(checked) => setEditFormValues({ ...editFormValues, isActive: checked })}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Page Access</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3">
                            {PAGE_OPTIONS.map((opt) => {
                              const checked = editFormValues.pageAccess.includes(opt.id)
                              return (
                                <Label
                                  key={opt.id}
                                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(val) => {
                                      setEditFormValues({
                                        ...editFormValues,
                                        pageAccess: val
                                          ? [...editFormValues.pageAccess, opt.id]
                                          : editFormValues.pageAccess.filter((id) => id !== opt.id),
                                      })
                                    }}
                                  />
                                  <span className="font-medium text-sm">{opt.label}</span>
                                </Label>
                              )
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">Select which pages this user can view.</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
            <DialogFooter className="gap-2 pt-2 border-t mt-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button disabled={updateUser.isPending} onClick={handleSaveUser}>
                {updateUser.isPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-3xl lg:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user profile and assign roles and page access.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[75vh] pr-4">
              <div className="space-y-5 py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                  {/* Left Column */}
                  <div className="space-y-5">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Profile Information</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3">
                        <Field orientation="vertical">
                          <FieldLabel>Username *</FieldLabel>
                          <FieldContent>
                            <Input
                              value={createFormValues.username}
                              onChange={(e) => setCreateFormValues({ ...createFormValues, username: e.target.value })}
                              placeholder="john_doe"
                            />
                          </FieldContent>
                        </Field>

                        <Field orientation="vertical">
                          <FieldLabel>Password *</FieldLabel>
                          <FieldContent>
                            <div className="relative">
                              <Input
                                type={showCreatePassword ? "text" : "password"}
                                value={createFormValues.password}
                                onChange={(e) => setCreateFormValues({ ...createFormValues, password: e.target.value })}
                                placeholder="Minimum 6 characters"
                                className="pr-10"
                              />
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowCreatePassword(!showCreatePassword)}
                              >
                                {showCreatePassword ? (
                                  <EyeOffIcon className="size-4" />
                                ) : (
                                  <EyeIcon className="size-4" />
                                )}
                              </button>
                            </div>
                          </FieldContent>
                        </Field>

                        <Field orientation="vertical">
                          <FieldLabel>Name</FieldLabel>
                          <FieldContent>
                            <Input
                              value={createFormValues.name}
                              onChange={(e) => setCreateFormValues({ ...createFormValues, name: e.target.value })}
                              placeholder="John Doe"
                            />
                          </FieldContent>
                        </Field>

                        <Field orientation="vertical">
                          <FieldLabel>Email</FieldLabel>
                          <FieldContent>
                            <Input
                              type="email"
                              value={createFormValues.email}
                              onChange={(e) => setCreateFormValues({ ...createFormValues, email: e.target.value })}
                              placeholder="john@example.com"
                            />
                          </FieldContent>
                        </Field>

                        <Field orientation="vertical">
                          <FieldLabel>Phone Number</FieldLabel>
                          <FieldContent>
                            <Input
                              maxLength={10}
                              value={createFormValues.phoneNumber || ""}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "");
                                setCreateFormValues({ ...createFormValues, phoneNumber: val });
                              }}
                              placeholder="10 digit number"
                            />
                          </FieldContent>
                        </Field>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-5">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Permissions</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4">
                        <Field orientation="vertical">
                          <FieldLabel>Role</FieldLabel>
                          <FieldContent>
                            <Select
                              value={createFormValues.role}
                              onValueChange={(v) => setCreateFormValues({ ...createFormValues, role: v as "ADMIN" | "VIEWER" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="VIEWER">Viewer</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </FieldContent>
                        </Field>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <Label htmlFor="createIsActive" className="font-medium cursor-pointer">Active Account</Label>
                            <p className="text-xs text-muted-foreground">Allow this user to log in</p>
                          </div>
                          <Switch
                            id="createIsActive"
                            checked={createFormValues.isActive}
                            onCheckedChange={(checked) => setCreateFormValues({ ...createFormValues, isActive: checked })}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Page Access</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3">
                          {PAGE_OPTIONS.map((opt) => {
                            const checked = createFormValues.pageAccess.includes(opt.id)
                            return (
                              <Label
                                key={opt.id}
                                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(val) => {
                                    setCreateFormValues({
                                      ...createFormValues,
                                      pageAccess: val
                                        ? [...createFormValues.pageAccess, opt.id]
                                        : createFormValues.pageAccess.filter((id) => id !== opt.id),
                                    })
                                  }}
                                />
                                <span className="font-medium text-sm">{opt.label}</span>
                              </Label>
                            )
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">Select which pages this user can view.</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="gap-2 pt-2 border-t mt-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button disabled={createUser.isPending} onClick={handleCreateUser}>
                {createUser.isPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </>
  )
}
