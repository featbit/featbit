"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  FolderKanban,
  Plus,
  Flag,
  ExternalLink,
  FolderOpen,
  KeyRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { appPath } from "@/lib/app-path";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Experiments",
    items: [
      { href: "/experiments", label: "All Experiments", icon: FolderKanban },
      { href: "/experiments/new", label: "New Experiment", icon: Plus },
    ],
  },
  {
    label: "Control",
    items: [
      { href: "https://app.featbit.co", label: "Feature Flags", icon: Flag, external: true },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/data/env-settings", label: "Env Settings", icon: KeyRound },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/experiments"
          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent"
        >
          <img
            src={appPath("/logo.svg")}
            alt="FeatBit Experimentation"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-lg bg-white shadow-sm ring-1 ring-sidebar-border"
          />
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-bold text-sm truncate tracking-tight">FeatBit</span>
            <span className="text-[10px] font-medium text-sidebar-foreground/55 truncate">
              Experimentation
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ href, label, icon: Icon, external }) => {
                  const active = !external && (pathname === href || pathname.startsWith(`${href}/`));
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={active}
                        className={cn(active && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-primary/20 hover:bg-sidebar-primary hover:text-sidebar-primary-foreground")}
                        render={
                          external ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" />
                          ) : (
                            <Link href={href} />
                          )
                        }
                      >
                        <Icon className="size-4" />
                        <span>{label}</span>
                        {external && <ExternalLink className="size-3 ml-auto opacity-50" />}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* ─── Separator between project/env-scoped and workspace-level items ─── */}
        <SidebarSeparator className="my-2" />

        {/* ─── Workspace-level items (not tied to the current project/env) ─── */}
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <a
                      href="https://app.featbit.co/en/workspace/projects"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <FolderOpen className="size-4" />
                  <span>Projects</span>
                  <ExternalLink className="size-3 ml-auto opacity-50" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="mx-0 rounded-lg border border-sidebar-border/80 bg-background/45 p-2 text-xs text-muted-foreground dark:bg-white/[0.035]">
          <div className="font-semibold text-foreground">Experiment workspace</div>
          <div className="mt-1 leading-relaxed">Flags, evidence, decisions, and learning in one clean lane.</div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-sidebar-border/80 bg-background/45 px-2 py-1.5 dark:bg-white/[0.035]">
          <span className="text-xs font-semibold text-muted-foreground">Theme</span>
          <ThemeToggle compact />
        </div>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
