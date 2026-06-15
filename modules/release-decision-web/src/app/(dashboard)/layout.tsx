"use client";

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
import Link from "next/link";
import Image from "next/image";
import { AuthShell } from "@/components/auth/auth-shell";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";
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
      <main className="flex h-full w-full flex-col overflow-hidden">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/78 px-4 backdrop-blur-xl">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-accent"
          >
            <Image
              src={appPath("/logo.svg")}
              alt="FeatBit"
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-md bg-white shadow-sm ring-1 ring-border"
            />
            <div className="hidden min-w-0 leading-tight sm:flex sm:flex-col">
              <span className="truncate text-sm font-bold tracking-tight">FeatBit</span>
              <span className="truncate text-[11px] font-medium text-muted-foreground">
                Release Decision
              </span>
            </div>
          </Link>

          {!hideBackToFeatBit && (
            <a
              href={FEATBIT_MAIN_PATH}
              className="inline-flex h-7 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back to FeatBit</span>
            </a>
          )}

          {headerContent && (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {headerContent}
            </div>
          )}

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <WorkspaceSwitcher readOnly className="hidden max-w-[52vw] md:flex" />
            <ThemeToggle compact />
            <UserMenu compact />
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
