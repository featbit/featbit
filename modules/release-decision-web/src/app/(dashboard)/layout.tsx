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

const FEATBIT_MAIN_PATH = "/";

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
