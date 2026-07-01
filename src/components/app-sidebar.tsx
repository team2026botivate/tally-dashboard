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
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  FilesIcon,
  Building2Icon,
  Settings2Icon,
  CommandIcon,
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
    ...(hasAccess("dashboard") ? [{ title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> }] : []),
  ];

  const companyNav = [
    ...(hasAccess("companies") ? [{ title: "Companies", url: "/companies", icon: <Building2Icon /> }] : []),
    ...(hasAccess("company-data") ? [{ title: "Company Data", url: "/company-data", icon: <FilesIcon /> }] : []),
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">Tally ERP</span>
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
                {mainNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={pathname === item.url}
                      onClick={() => router.push(item.url)}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {companyNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Company</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {companyNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={pathname === item.url}
                      onClick={() => router.push(item.url)}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {hasAccess("settings") && (
          <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Settings"
                      isActive={pathname === '/settings'}
                      onClick={() => router.push('/settings')}
                    >
                      <Settings2Icon />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
