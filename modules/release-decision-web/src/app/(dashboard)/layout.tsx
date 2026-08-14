import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Link } from "@/lib/router";
import { AuthShell } from "@/components/auth/auth-shell";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { appPath } from "@/lib/app-path";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "@/lib/router";

const FEATBIT_MAIN_PATH = "/";

const NAV_ITEMS = [
  { href: "/", label: "Experiments" },
  { href: "/release-decision-metrics", label: "Metrics" },
  { href: "/release-decision-layers", label: "Layers" },
];

const DashboardHeaderContext = createContext<{
  setHeaderContent: Dispatch<SetStateAction<ReactNode>>;
} | null>(null);

export function useDashboardHeader(content: ReactNode | null) {
  const context = useContext(DashboardHeaderContext);

  useEffect(() => {
    if (!context) return;

    context.setHeaderContent(content);
    return () => context.setHeaderContent(null);
  }, [content, context]);
}

export default function DashboardLayout({
  children,
  contentClassName,
  hideBackToFeatBit,
}: {
  children: ReactNode;
  contentClassName?: string;
  hideBackToFeatBit?: boolean;
}) {
  const [headerContent, setHeaderContent] = useState<ReactNode>(null);
  const pathname = usePathname();
  const headerContextValue = useMemo(
    () => ({ setHeaderContent }),
    [setHeaderContent],
  );

  return (
    <AuthShell>
      <DashboardHeaderContext.Provider value={headerContextValue}>
      <main className="fb-dashboard-shell">
        <header className="fb-dashboard-topbar">
          <Link
            href="/"
            className="fb-dashboard-brand"
          >
            <img
              src={appPath("/logo.svg")}
              alt="FeatBit"
              width={40}
              height={40}
              className="fb-dashboard-logo"
            />
            <div className="fb-dashboard-brand-copy">
              <span className="fb-dashboard-brand-name">FeatBit</span>
              <span className="fb-dashboard-brand-subtitle">
                Release Decision
              </span>
            </div>
          </Link>

          {!headerContent && (
            <nav className="hidden items-center gap-1 rounded-md border border-border/70 bg-background/70 p-1 md:flex">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                      active && "bg-foreground text-background hover:bg-foreground hover:text-background",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {!hideBackToFeatBit && (
            <a
              href={FEATBIT_MAIN_PATH}
              className="fb-topbar-back"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back to FeatBit</span>
            </a>
          )}

          {headerContent && (
            <div className="fb-topbar-content">
              {headerContent}
            </div>
          )}

          <div className="fb-topbar-actions">
            <ThemeToggle compact />
            <div className="fb-topbar-workspace">
              <WorkspaceSwitcher readOnly />
            </div>
          </div>
        </header>
        <div
          className={cn(
            "flex-1 min-h-0 overflow-auto px-4 py-4 md:px-6 lg:px-7",
            contentClassName,
          )}
        >
          {children}
        </div>
      </main>
      </DashboardHeaderContext.Provider>
    </AuthShell>
  );
}
