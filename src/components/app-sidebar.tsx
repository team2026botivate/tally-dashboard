"use client";

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"

import { NavUser } from "@/components/nav-user"
import { useAuth } from "@/lib/auth-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  LayoutDashboardIcon,
  FilesIcon,
  Building2Icon,
  Settings2Icon,
  ListChecksIcon,
  CommandIcon,
  RefreshCwIcon,
  ChevronRightIcon,
} from "lucide-react"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const user = {
    name: authUser?.name || authUser?.username || "User",
    email: authUser?.email || authUser?.username || "",
    avatar: authUser?.profilePicture || "/avatars/shadcn.jpg",
  };

  const pageAccess = authUser?.pageAccess || [];
  const isAdmin = authUser?.role === "ADMIN";
  const hasAccess = (page: string) => isAdmin || pageAccess.includes(page);

  const mainNav = [
    ...(hasAccess("dashboard") ? [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon }] : []),
  ];

  const hasCompanyAccess = hasAccess("companies") || hasAccess("company-data");

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <CommandIcon className="size-6!" />
                <span className="text-lg font-semibold">Tally ERP</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {mainNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        tooltip={item.title}
                        size="lg"
                        isActive={pathname === item.url}
                        className="text-foreground hover:bg-foreground/5 hover:text-foreground data-active:bg-foreground data-active:text-background data-active:font-semibold hover:data-active:bg-foreground hover:data-active:text-background [&_svg]:text-current data-active:rounded-lg"
                        onClick={() => router.push(item.url)}
                      >
                        <Icon className="size-5!" />
                        <span className="text-base">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {hasAccess("tally-configuration") && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Tally Configuration"
                    size="lg"
                    isActive={pathname === "/tally-configuration"}
                    className="text-foreground hover:bg-foreground/5 hover:text-foreground data-active:bg-foreground data-active:text-background data-active:font-semibold hover:data-active:bg-foreground hover:data-active:text-background [&_svg]:text-current data-active:rounded-lg"
                    onClick={() => router.push("/tally-configuration")}
                  >
                    <ListChecksIcon className="size-5!" />
                    <span className="text-base">Tally Configuration</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {hasCompanyAccess && (
          <>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger>
                    <span className="text-sm">Company</span>
                    <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {hasAccess("companies") && (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            tooltip="Companies"
                            size="lg"
                            isActive={pathname === "/companies"}
                            className="text-foreground hover:bg-foreground/5 hover:text-foreground data-active:bg-foreground data-active:text-background data-active:font-semibold hover:data-active:bg-foreground hover:data-active:text-background [&_svg]:text-current data-active:rounded-lg"
                            onClick={() => router.push("/companies")}
                          >
                            <Building2Icon className="size-5!" />
                            <span className="text-base">Companies</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                      {hasAccess("company-data") && (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            tooltip="Company Data"
                            size="lg"
                            isActive={pathname === "/company-data"}
                            className="text-foreground hover:bg-foreground/5 hover:text-foreground data-active:bg-foreground data-active:text-background data-active:font-semibold hover:data-active:bg-foreground hover:data-active:text-background [&_svg]:text-current data-active:rounded-lg"
                            onClick={() => router.push("/company-data")}
                          >
                            <FilesIcon className="size-5!" />
                            <span className="text-base">Company Data</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {hasAccess("settings") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Settings"
                    size="lg"
                    isActive={pathname === "/settings"}
                    className="text-foreground hover:bg-foreground/5 hover:text-foreground data-active:bg-foreground data-active:text-background data-active:font-semibold hover:data-active:bg-foreground hover:data-active:text-background [&_svg]:text-current data-active:rounded-lg"
                    onClick={() => router.push("/settings")}
                  >
                    <Settings2Icon className="size-5!" />
                    <span className="text-base">Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
