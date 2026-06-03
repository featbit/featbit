import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthShell } from "@/components/auth/auth-shell";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthShell>
      <SidebarProvider>
        <div className="flex h-full w-full">
          <AppSidebar />
          <main className="flex-1 overflow-auto flex flex-col">
            <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border/70 bg-background/75 px-3 backdrop-blur-xl">
              <SidebarTrigger />
              <div className="ml-auto flex items-center gap-2">
                <WorkspaceSwitcher />
              </div>
            </header>
            <div className="flex-1 px-4 py-4 md:px-6 lg:px-7">{children}</div>
          </main>
        </div>
      </SidebarProvider>
    </AuthShell>
  );
}
