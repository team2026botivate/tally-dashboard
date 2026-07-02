"use client";

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Settings2Icon,
  ServerIcon,
  PlugIcon,
  WrenchIcon,
  RefreshCwIcon,
  RadioIcon,
  TerminalIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  DownloadIcon,
  GlobeIcon,
  NetworkIcon,
} from "lucide-react"

interface StepProps {
  number: number;
  title: string;
  description: string;
  details: string[];
  icon: React.ElementType;
  action?: { label: string; href: string; variant?: "default" | "download" };
  isLast?: boolean;
}

function StepCard({ number, title, description, details, icon: Icon, action, isLast, router }: StepProps & { router: ReturnType<typeof useRouter> }) {
  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute left-6 top-14 bottom-0 w-px bg-border" />
      )}
      <Card className="relative">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
              <Icon className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs font-mono">Step {number}</Badge>
                <CardTitle className="text-lg">{title}</CardTitle>
              </div>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {details.map((detail, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 size-1.5 rounded-full bg-sidebar-primary shrink-0" />
                <span>{detail}</span>
              </li>
            ))}
          </ul>
          {action && action.variant === "download" ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-200 text-green-800">
                  <DownloadIcon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-black">Ready to download</p>
                  <p className="text-xs text-black">tally-agent.zip — includes agent script + dependencies</p>
                </div>
                <Button
                  className="shrink-0 gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                  size="default"
                  onClick={() => router.push(action.href)}
                >
                  <DownloadIcon className="size-4" />
                  {action.label}
                </Button>
              </div>
            </div>
          ) : action && (
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => router.push(action.href)}>
              {action.label}
              <ArrowRightIcon className="size-3" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function TallyConfigurationPage() {
  const router = useRouter()

  const steps: StepProps[] = [
    {
      number: 1,
      title: "Verify Prerequisites",
      description: "Ensure your system meets the basic requirements.",
      icon: CheckCircle2Icon,
      details: [
        "Tally ERP 9 (Release 6.6.3 or later) installed and running on your local machine or network.",
        "Network access between the dashboard and Tally — both machines must be on the same LAN, or you must use the agent for cloud setups.",
        "Tally must have the HTTP server enabled (see Step 2).",
        "A user account with admin privileges on this dashboard (create one in Settings if needed).",
      ],
    },
    {
      number: 2,
      title: "Enable Tally's HTTP Server",
      description: "Turn on Tally's built-in XML API server so the dashboard can communicate with it.",
      icon: ServerIcon,
      details: [
        "Open Tally and go to Gateway of Tally > F12: Configure > Network.",
        'Set "Allow External Access" to "Yes".',
        'Under "Allowed External Access From", enter the IP address range of the dashboard server (e.g., 192.168.1.* for local LAN, or 0.0.0.0 for any — use caution in production).',
        "Keep the default port as 9000 or set a custom port (remember this for Step 3).",
        "Restart Tally ERP for the changes to take effect.",
        "To verify, open http://localhost:9000 in a browser — you should see an XML response from Tally.",
      ],
      action: { label: "Test Connection", href: "/settings" },
    },
    {
      number: 3,
      title: "Configure Connection in Settings",
      description: "Enter the Tally host and port in this dashboard to establish the link.",
      icon: PlugIcon,
      details: [
        'Go to the Settings page and select the "Tally Connection" tab.',
        "Enter the Host (IP address or hostname of the machine running Tally) — use localhost if Tally is on the same machine.",
        "Enter the Port (default is 9000).",
        'Click "Save Configuration" to persist the settings.',
        "The system will automatically trigger a full sync after saving.",
      ],
      action: { label: "Open Settings", href: "/settings" },
    },
    {
      number: 4,
      title: "Test the Connection",
      description: "Verify that the dashboard can reach Tally ERP before syncing data.",
      icon: WrenchIcon,
      details: [
        'On the Settings page, click "Test Connection" to send a ping to Tally.',
        "If successful, you will see a green success alert — your dashboard is connected.",
        "If the test fails, check that Tally is running, the HTTP server is enabled (Step 2), and there are no firewall rules blocking the port.",
        "For cloud-hosted dashboards (Vercel), the test will show a message about needing the agent — proceed to Step 6.",
      ],
      action: { label: "Test Now", href: "/settings" },
    },
    {
      number: 5,
      title: "Sync Your Data",
      description: "Pull ledgers, vouchers, stock items and other data from Tally into the dashboard.",
      icon: RefreshCwIcon,
      details: [
        'On the Settings page, you will see the "Sync Management" section with multiple sync options.',
        'Use the individual buttons for targeted syncs: Ledgers, Vouchers, Stock.',
        'Use "Full Sync" to sync everything at once, or "Sync All Companies" to sync all discovered companies.',
        "You can monitor sync progress via the progress bar and check past syncs in the Sync History dialog.",
        "Once synced, view your data on the Dashboard, Companies, and Company Data pages.",
      ],
      action: { label: "Go to Dashboard", href: "/dashboard" },
    },
    {
      number: 6,
      title: "Set Up the Agent (Cloud Deployments Only)",
      description: "If your dashboard is hosted on the cloud (Vercel), the cloud server cannot reach your local Tally. You need the Tally Agent — a lightweight script that runs on your local PC and pushes data to the cloud.",
      icon: RadioIcon,
      details: [
        "The agent is required because cloud servers (like Vercel) cannot access private IPs (localhost, 192.168.x.x, etc.) on your local network.",
        "The agent runs as a simple Node.js script on the same machine as Tally (or any machine that can reach Tally).",
        "It fetches data from Tally via the XML API, extracts the records, and POSTs them to your cloud dashboard's API endpoints.",
        "The agent authenticates using a gatewayId and deviceSecret — generated once during registration.",
        "It sends a heartbeat every sync cycle so the cloud knows the agent is online.",
      ],
    },
    {
      number: 7,
      title: "Install & Run the Agent",
      description: "Download and start the agent script on your local machine.",
      icon: TerminalIcon,
      details: [
        "Prerequisites: Node.js 18 or later installed on the local machine.",
        "Download the tally-agent.zip using the button below and extract it to a folder on your PC.",
        "Open a terminal (PowerShell on Windows) in the extracted folder and run: npm install.",
        "Set the CLOUD_URL environment variable to your cloud dashboard URL:",
        "  — PowerShell: $env:CLOUD_URL=\"https://tallyprimeone.vercel.app\"",
        "  — CMD: set CLOUD_URL=https://tallyprimeone.vercel.app",
        "  — macOS/Linux: export CLOUD_URL=https://tallyprimeone.vercel.app",
        "Start the agent with: npm start.",
        "On first run, the agent will automatically register with the cloud and save credentials to agent-config.json.",
        "The agent will then discover companies from your local Tally and begin syncing data on the configured interval (default: every 5 minutes).",
        "You should see log output showing each sync cycle — ledgers, stock groups, stock items, and vouchers being sent to the cloud.",
      ],
      action: { label: "Download Agent", href: "/downloads/tally-agent.zip", variant: "download" },
    },
    {
      number: 8,
      title: "Verify the Setup",
      description: "Confirm everything is working end-to-end.",
      icon: GlobeIcon,
      details: [
        "Check the Dashboard — you should see data cards populated with your ledger counts, voucher totals, and stock summaries.",
        "Visit the Companies page to see all discovered companies and their sync status.",
        "On the Settings page, the Sync History dialog will show a log of all sync operations with their status.",
        'If the agent is running, you will see the configuration marked as "ONLINE" on the Companies page.',
        "If any step fails, check the agent logs for error messages or use the Sync History to diagnose issues.",
      ],
    },
  ]

  return (
    <>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="@container/main flex flex-1 flex-col py-4 md:py-6">
          <div className="px-4 lg:px-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Settings2Icon className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold md:text-2xl">Tally Configuration</h1>
                <p className="text-sm text-muted-foreground">
                  Follow these steps to connect this dashboard to your Tally ERP instance
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 lg:px-6 max-w-3xl space-y-6">
            {steps.map((step, i) => (
              <StepCard key={i} {...step} router={router} isLast={i === steps.length - 1} />
            ))}
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
