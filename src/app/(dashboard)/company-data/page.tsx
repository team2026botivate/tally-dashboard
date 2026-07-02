"use client";

import { useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table"
import { ArrowUpDown, SearchIcon } from "lucide-react"
import { useCompany } from "@/lib/company-provider"
import { useTrialBalance, useRecentVouchers, useStockSummary } from "@/lib/hooks/use-dashboard"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { SidebarInset } from "@/components/ui/sidebar"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

interface LedgerRow {
  name: string
  groupName: string
  parentGroup?: string
  openingBalance: string
  currentBalance: string
}

interface VoucherRow {
  voucherNumber: string
  voucherDate: string
  narration: string | null
  totalAmount: string
  voucherType: { name: string }
}

interface StockRow {
  name: string
  unit: string
  openingQty: string
  closingQty: string
  closingValue: string
  stockGroup: { name: string }
}

function DataTableCard<T extends Record<string, unknown>>({
  title,
  description,
  data,
  columns,
  isLoading,
  searchPlaceholder,
  globalFilter,
  onGlobalFilterChange,
}: {
  title: string
  description: string
  data: T[]
  columns: ColumnDef<T>[]
  isLoading: boolean
  searchPlaceholder?: string
  globalFilter?: string
  onGlobalFilterChange?: (val: string) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  })

  return (
    <Card className="mx-4 lg:mx-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {searchPlaceholder && onGlobalFilterChange && (
            <div className="relative w-48">
              <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => onGlobalFilterChange(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {data.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">{data.length} records</p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface GroupNode {
  name: string;
  parent: string | null;
  opening: number;
  current: number;
  subgroups: Map<string, GroupNode>;
  ledgers: LedgerRow[];
}

const buildTrialBalanceTree = (ledgers: LedgerRow[]) => {
  const rootGroups = new Map<string, GroupNode>();
  const allGroups = new Map<string, GroupNode>();

  ledgers.forEach(l => {
    const groupName = l.groupName || 'Primary';
    const parentName = l.parentGroup && l.parentGroup !== groupName ? l.parentGroup : null;

    if (!allGroups.has(groupName)) {
      allGroups.set(groupName, {
        name: groupName,
        parent: parentName,
        opening: 0,
        current: 0,
        subgroups: new Map(),
        ledgers: []
      });
    }

    const gNode = allGroups.get(groupName)!;
    gNode.ledgers.push(l);
    gNode.opening += parseFloat(l.openingBalance) || 0;
    gNode.current += parseFloat(l.currentBalance) || 0;
  });

  allGroups.forEach(gNode => {
    if (gNode.parent) {
      if (!allGroups.has(gNode.parent)) {
        allGroups.set(gNode.parent, {
          name: gNode.parent,
          parent: null,
          opening: 0,
          current: 0,
          subgroups: new Map(),
          ledgers: []
        });
      }
      const parentNode = allGroups.get(gNode.parent)!;
      parentNode.subgroups.set(gNode.name, gNode);
    } else {
      rootGroups.set(gNode.name, gNode);
    }
  });

  const rollUpBalances = (node: GroupNode): { opening: number; current: number } => {
    let subOpening = 0;
    let subCurrent = 0;
    node.subgroups.forEach(sub => {
      const { opening, current } = rollUpBalances(sub);
      subOpening += opening;
      subCurrent += current;
    });
    node.opening += subOpening;
    node.current += subCurrent;
    return { opening: node.opening, current: node.current };
  };

  rootGroups.forEach(node => rollUpBalances(node));

  return Array.from(rootGroups.values());
};

const classifyLedger = (ledger: LedgerRow) => {
  const g = (ledger.groupName || '').toLowerCase();
  const p = (ledger.parentGroup || '').toLowerCase();
  const balance = parseFloat(ledger.currentBalance) || 0;

  // Expenses groups
  const expenseGroups = ['purchase accounts', 'direct expenses', 'indirect expenses', 'expense', 'expenses', 'cost of sales'];
  // Income groups
  const incomeGroups = ['sales accounts', 'direct incomes', 'indirect incomes', 'income', 'incomes', 'revenue'];

  if (expenseGroups.some(term => g.includes(term) || p.includes(term))) {
    return 'expense';
  }
  if (incomeGroups.some(term => g.includes(term) || p.includes(term))) {
    return 'income';
  }

  // Assets groups
  const assetGroups = ['asset', 'assets', 'fixed assets', 'investments', 'current assets', 'bank accounts', 'cash-in-hand', 'sundry debtors', 'loans & advances (asset)', 'deposits (asset)'];
  // Liabilities groups
  const liabilityGroups = ['liability', 'liabilities', 'capital account', 'loans (liability)', 'sundry creditors', 'duties & taxes', 'provisions', 'bank od a/c', 'reserves & surplus', 'branch / divisions'];

  if (assetGroups.some(term => g.includes(term) || p.includes(term))) {
    return 'asset';
  }
  if (liabilityGroups.some(term => g.includes(term) || p.includes(term))) {
    return 'liability';
  }

  return balance >= 0 ? 'asset' : 'liability';
};

const TrialBalanceTree = ({ ledgers, search }: { ledgers: LedgerRow[]; search: string }) => {
  const tree = useMemo(() => buildTrialBalanceTree(ledgers), [ledgers]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const renderNode = (node: GroupNode, depth: number) => {
    const isNodeExpanded = expanded[node.name] || search.length > 0;
    const hasChildren = node.subgroups.size > 0 || node.ledgers.length > 0;

    const filteredLedgers = node.ledgers.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));
    const visibleSubgroups = Array.from(node.subgroups.values()).filter(sub => {
      const matchesName = sub.name.toLowerCase().includes(search.toLowerCase());
      const hasMatchingLedgers = sub.ledgers.some(l => l.name.toLowerCase().includes(search.toLowerCase()));
      return matchesName || hasMatchingLedgers;
    });

    if (search.length > 0 && filteredLedgers.length === 0 && visibleSubgroups.length === 0) {
      return null;
    }

    return (
      <div key={node.name} className="w-full">
        <div
          className="flex items-center justify-between py-2.5 border-b border-border/40 hover:bg-muted/40 cursor-pointer font-medium select-none text-sm pr-4"
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          onClick={() => toggle(node.name)}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren && (
              <span className="text-muted-foreground text-[10px] font-mono shrink-0">
                {isNodeExpanded ? "▼" : "▶"}
              </span>
            )}
            <span className="truncate">{node.name}</span>
          </div>
          <div className="flex gap-6 shrink-0 font-mono text-xs">
            <span className="w-36 text-right text-muted-foreground">
              {node.opening.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="w-36 text-right">
              {node.current.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {isNodeExpanded && (
          <div className="w-full">
            {visibleSubgroups.map(sub => renderNode(sub, depth + 1))}
            {filteredLedgers.map(l => (
              <div
                key={l.name}
                className="flex items-center justify-between py-2 border-b border-border/20 hover:bg-muted/20 text-xs text-muted-foreground pr-4"
                style={{ paddingLeft: `${(depth + 1) * 20 + 24}px` }}
              >
                <span className="truncate pr-4">{l.name}</span>
                <div className="flex gap-6 shrink-0 font-mono">
                  <span className="w-36 text-right text-muted-foreground/75">
                    {(parseFloat(l.openingBalance) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="w-36 text-right font-medium text-foreground">
                    {(parseFloat(l.currentBalance) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg bg-card text-card-foreground overflow-hidden">
      <div className="flex items-center justify-between bg-muted/60 py-3 border-b border-border/80 font-semibold text-xs px-4 pr-8">
        <span>Group / Ledger</span>
        <div className="flex gap-6 shrink-0">
          <span className="w-36 text-right">Opening Balance</span>
          <span className="w-36 text-right">Closing Balance</span>
        </div>
      </div>
      <div className="divide-y divide-border/20 max-h-[65vh] overflow-y-auto">
        {tree.map(root => renderNode(root, 0))}
      </div>
    </div>
  );
};

const BalanceSheetReport = ({ ledgers }: { ledgers: LedgerRow[] }) => {
  const liabilities: LedgerRow[] = [];
  const assets: LedgerRow[] = [];
  let totalIncome = 0;
  let totalExpense = 0;

  ledgers.forEach(l => {
    const category = classifyLedger(l);
    if (category === 'liability') {
      liabilities.push(l);
    } else if (category === 'asset') {
      assets.push(l);
    } else if (category === 'income') {
      totalIncome += Math.abs(parseFloat(l.currentBalance) || 0);
    } else if (category === 'expense') {
      totalExpense += parseFloat(l.currentBalance) || 0;
    }
  });

  const netProfit = totalIncome - totalExpense;

  const groupBalances = (list: LedgerRow[]) => {
    const map = new Map<string, number>();
    list.forEach(l => {
      const balance = parseFloat(l.currentBalance) || 0;
      map.set(l.groupName, (map.get(l.groupName) || 0) + balance);
    });
    return Array.from(map.entries()).map(([name, balance]) => ({ name, balance }));
  };

  const liabilityGroups = groupBalances(liabilities);
  const assetGroups = groupBalances(assets);

  const sumLiabilities = liabilityGroups.reduce((sum, g) => sum + Math.abs(g.balance), 0);
  const sumAssets = assetGroups.reduce((sum, g) => sum + Math.abs(g.balance), 0);

  let liabilitiesTotal = sumLiabilities;
  let assetsTotal = sumAssets;

  if (netProfit > 0) {
    liabilitiesTotal += netProfit;
  } else {
    assetsTotal += Math.abs(netProfit);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border rounded-lg bg-card text-card-foreground overflow-hidden">
      {/* Liabilities Column */}
      <div className="border-r border-border p-5 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-base border-b pb-3 mb-4 text-primary">Liabilities</h3>
          <div className="space-y-2.5">
            {liabilityGroups.map(g => (
              <div key={g.name} className="flex justify-between text-sm py-1.5 border-b border-border/40 font-mono">
                <span className="font-sans font-medium">{g.name}</span>
                <span>{Math.abs(g.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            {netProfit > 0 && (
              <div className="flex justify-between text-sm py-1.5 text-green-600 border-b border-border/40 font-mono font-medium">
                <span className="font-sans">Profit & Loss A/c (Net Profit)</span>
                <span>{netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between font-bold border-t-2 border-primary mt-8 pt-3 text-primary font-mono text-base">
          <span className="font-sans">Total Liabilities</span>
          <span>{liabilitiesTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Assets Column */}
      <div className="p-5 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-base border-b pb-3 mb-4 text-primary">Assets</h3>
          <div className="space-y-2.5">
            {assetGroups.map(g => (
              <div key={g.name} className="flex justify-between text-sm py-1.5 border-b border-border/40 font-mono">
                <span className="font-sans font-medium">{g.name}</span>
                <span>{Math.abs(g.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            {netProfit < 0 && (
              <div className="flex justify-between text-sm py-1.5 text-red-600 border-b border-border/40 font-mono font-medium">
                <span className="font-sans">Profit & Loss A/c (Net Loss)</span>
                <span>{Math.abs(netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between font-bold border-t-2 border-primary mt-8 pt-3 text-primary font-mono text-base">
          <span className="font-sans">Total Assets</span>
          <span>{assetsTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
};

const ProfitAndLossReport = ({ ledgers }: { ledgers: LedgerRow[] }) => {
  const expenses: LedgerRow[] = [];
  const incomes: LedgerRow[] = [];

  ledgers.forEach(l => {
    const category = classifyLedger(l);
    if (category === 'expense') {
      expenses.push(l);
    } else if (category === 'income') {
      incomes.push(l);
    }
  });

  const expenseGroups = Array.from(
    expenses.reduce((map, l) => {
      const val = parseFloat(l.currentBalance) || 0;
      map.set(l.groupName, (map.get(l.groupName) || 0) + val);
      return map;
    }, new Map<string, number>()).entries()
  ).map(([name, balance]) => ({ name, balance }));

  const incomeGroups = Array.from(
    incomes.reduce((map, l) => {
      const val = parseFloat(l.currentBalance) || 0;
      map.set(l.groupName, (map.get(l.groupName) || 0) + val);
      return map;
    }, new Map<string, number>()).entries()
  ).map(([name, balance]) => ({ name, balance }));

  const totalExpense = expenseGroups.reduce((sum, g) => sum + g.balance, 0);
  const totalIncome = incomeGroups.reduce((sum, g) => sum + Math.abs(g.balance), 0);

  const netProfit = totalIncome - totalExpense;

  let leftTotal = totalExpense;
  let rightTotal = totalIncome;

  if (netProfit > 0) {
    leftTotal += netProfit;
  } else {
    rightTotal += Math.abs(netProfit);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border rounded-lg bg-card text-card-foreground overflow-hidden">
      {/* Expenses Column */}
      <div className="border-r border-border p-5 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-base border-b pb-3 mb-4 text-primary">Expenses</h3>
          <div className="space-y-2.5">
            {expenseGroups.map(g => (
              <div key={g.name} className="flex justify-between text-sm py-1.5 border-b border-border/40 font-mono">
                <span className="font-sans font-medium">{g.name}</span>
                <span>{g.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            {netProfit > 0 && (
              <div className="flex justify-between text-sm py-1.5 text-green-600 border-b border-border/40 font-mono font-semibold">
                <span className="font-sans">Net Profit</span>
                <span>{netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between font-bold border-t-2 border-primary mt-8 pt-3 text-primary font-mono text-base">
          <span className="font-sans">Total</span>
          <span>{leftTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Incomes Column */}
      <div className="p-5 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-base border-b pb-3 mb-4 text-primary">Incomes</h3>
          <div className="space-y-2.5">
            {incomeGroups.map(g => (
              <div key={g.name} className="flex justify-between text-sm py-1.5 border-b border-border/40 font-mono">
                <span className="font-sans font-medium">{g.name}</span>
                <span>{Math.abs(g.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            {netProfit < 0 && (
              <div className="flex justify-between text-sm py-1.5 text-red-600 border-b border-border/40 font-mono font-semibold">
                <span className="font-sans">Net Loss</span>
                <span>{Math.abs(netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between font-bold border-t-2 border-primary mt-8 pt-3 text-primary font-mono text-base">
          <span className="font-sans">Total</span>
          <span>{rightTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
};

export default function CompanyDataPage() {
  const { activeCompany } = useCompany()
  const { data: ledgers = [], isLoading: loadingLedgers } = useTrialBalance(activeCompany?.id)
  const { data: vouchers = [], isLoading: loadingVouchers } = useRecentVouchers(activeCompany?.id, 10000)
  const { data: stockItems = [], isLoading: loadingStock } = useStockSummary(activeCompany?.id)

  const [ledgerSearch, setLedgerSearch] = useState("")
  const [voucherSearch, setVoucherSearch] = useState("")
  const [stockSearch, setStockSearch] = useState("")

  const isLoading = loadingLedgers || loadingVouchers || loadingStock

  const ledgerColumns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      { accessorKey: "name", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
          Name <ArrowUpDown className="size-3" />
        </button>
      )},
      { accessorKey: "groupName", header: "Group",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
      { accessorKey: "openingBalance", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Opening Balance <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right font-mono">{v.toLocaleString("en-IN")}</span>
      }},
      { accessorKey: "currentBalance", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Current Balance <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right font-mono">{v.toLocaleString("en-IN")}</span>
      }},
    ], []
  )

  const voucherColumns = useMemo<ColumnDef<VoucherRow>[]>(
    () => [
      { accessorKey: "voucherNumber", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
          Voucher # <ArrowUpDown className="size-3" />
        </button>
      )},
      { accessorKey: "voucherDate", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
          Date <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("en-IN") },
      { accessorFn: (r) => r.voucherType?.name ?? "-", id: "type", header: "Type",
        cell: ({ getValue }) => <Badge variant="outline">{getValue() as string}</Badge> },
      { accessorKey: "narration", header: "Narration",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return <span className="max-w-48 truncate text-muted-foreground block">{v || "-"}</span>
        }},
      { accessorKey: "totalAmount", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Amount <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right font-mono">{v.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 })}</span>
      }},
    ], []
  )

  const stockColumns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      { accessorKey: "name", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
          Item <ArrowUpDown className="size-3" />
        </button>
      )},
      { accessorFn: (r) => r.stockGroup?.name ?? "-", id: "group", header: "Group",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
      { accessorKey: "unit", header: "Unit",
        cell: ({ getValue }) => (getValue() as string) || "-" },
      { accessorKey: "openingQty", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Opening Qty <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right font-mono">{v.toLocaleString("en-IN")}</span>
      }},
      { accessorKey: "closingQty", header: ({ column }) => (
        <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting()}>
          Closing Qty <ArrowUpDown className="size-3" />
        </button>
      ), cell: ({ getValue }) => {
        const v = parseFloat(getValue() as string) || 0
        return <span className="tabular-nums block text-right font-mono">{v.toLocaleString("en-IN")}</span>
      }},
    ], []
  )

  const filteredLedgers = useMemo(
    () => ledgers.filter((l) => !ledgerSearch || l.name.toLowerCase().includes(ledgerSearch.toLowerCase())),
    [ledgers, ledgerSearch]
  )
  const filteredVouchers = useMemo(
    () => vouchers.filter((v) => !voucherSearch || v.voucherNumber?.toLowerCase().includes(voucherSearch.toLowerCase())),
    [vouchers, voucherSearch]
  )
  const filteredStock = useMemo(
    () => stockItems.filter((s) => !stockSearch || s.name.toLowerCase().includes(stockSearch.toLowerCase())),
    [stockItems, stockSearch]
  )

  if (!activeCompany) {
    return (
      <>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 pt-4 px-4 lg:px-6">
            <p className="text-muted-foreground">No company selected. Please configure and activate a company first.</p>
          </div>
        </SidebarInset>
      </>
    )
  }

  return (
    <>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 pt-4 pb-8">
          <div className="px-4 lg:px-6">
            <h2 className="text-xl font-semibold mb-1 text-primary">{activeCompany.companyName}</h2>
            <p className="text-xs text-muted-foreground">
              {activeCompany.host}:{activeCompany.port}
              {activeCompany.lastSyncAt && ` · Last sync: ${new Date(activeCompany.lastSyncAt).toLocaleString("en-IN")}`}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4 px-4 lg:px-6 mt-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="px-4 lg:px-6">
              <Tabs defaultValue="trial-balance" className="space-y-4">
                <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full md:w-auto h-auto p-1 bg-muted rounded-lg">
                  <TabsTrigger value="trial-balance" className="py-2 px-3 text-xs md:text-sm">Trial Balance</TabsTrigger>
                  <TabsTrigger value="balance-sheet" className="py-2 px-3 text-xs md:text-sm">Balance Sheet</TabsTrigger>
                  <TabsTrigger value="profit-loss" className="py-2 px-3 text-xs md:text-sm">Profit & Loss</TabsTrigger>
                  <TabsTrigger value="day-book" className="py-2 px-3 text-xs md:text-sm">Day Book</TabsTrigger>
                  <TabsTrigger value="stock-summary" className="py-2 px-3 text-xs md:text-sm">Stock Summary</TabsTrigger>
                </TabsList>

                <TabsContent value="trial-balance" className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 max-w-xs">
                    <SearchIcon className="size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search Group/Ledger..."
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <TrialBalanceTree ledgers={ledgers} search={ledgerSearch} />
                </TabsContent>

                <TabsContent value="balance-sheet" className="pt-2">
                  <BalanceSheetReport ledgers={ledgers} />
                </TabsContent>

                <TabsContent value="profit-loss" className="pt-2">
                  <ProfitAndLossReport ledgers={ledgers} />
                </TabsContent>

                <TabsContent value="day-book" className="space-y-4 pt-2">
                  <DataTableCard
                    title={`Day Book (${vouchers.length} Vouchers)`}
                    description="All transactions sorted by date"
                    data={filteredVouchers as any}
                    columns={voucherColumns as any}
                    isLoading={false}
                    searchPlaceholder="Search vouchers..."
                    globalFilter={voucherSearch}
                    onGlobalFilterChange={setVoucherSearch}
                  />
                </TabsContent>

                <TabsContent value="stock-summary" className="space-y-4 pt-2">
                  <DataTableCard
                    title={`Stock Summary (${stockItems.length} Items)`}
                    description="Current stock quantities and groups"
                    data={filteredStock as any}
                    columns={stockColumns as any}
                    isLoading={false}
                    searchPlaceholder="Search stock..."
                    globalFilter={stockSearch}
                    onGlobalFilterChange={setStockSearch}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </SidebarInset>
    </>
  )
}
