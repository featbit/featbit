import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  chooseOrganization,
  chooseProjectEnv,
  chooseWorkspace,
  ContextBar,
  fallbackProjects,
  fetchOrganizations,
  fetchProjects,
  fetchWorkspaces,
  getCurrentOrganization,
  getCurrentProjectEnv,
  getCurrentWorkspace,
  normalizeProjects,
  persistCurrentOrganization,
  persistCurrentWorkspace,
  PlanBadge,
  resolveLang,
  saveCurrentProjectEnv,
  type Project
} from "./context";
import { Sidebar } from "./nav";

const SIDEBAR_STORAGE_KEY = "featbit:sidebar-collapsed";

function EmptyWorkspace() {
  const { t } = useTranslation();

  return (
    <section className="h-full rounded-md border border-dashed border-border bg-card/50 p-6">
      <div className="flex h-full min-h-[24rem] items-center justify-center text-sm text-muted-foreground">
        {t("layout.placeholder")}
      </div>
    </section>
  );
}

export function Layout() {
  const params = useParams();
  const lang = resolveLang(params.lang);
  const { i18n } = useTranslation();
  const [collapsed, setCollapsedState] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  const [workspace, setWorkspace] = useState(() => getCurrentWorkspace());
  const [organization, setOrganization] = useState(() => getCurrentOrganization());
  const [currentProjectEnv, setCurrentProjectEnv] = useState(() => getCurrentProjectEnv());
  const [projects, setProjects] = useState<Project[]>(() => normalizeProjects(fallbackProjects));

  function setCollapsed(nextCollapsed: boolean) {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextCollapsed));
    setCollapsedState(nextCollapsed);
  }

  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [i18n, lang]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const loadedWorkspaces = await fetchWorkspaces();
        if (cancelled) {
          return;
        }

        if (loadedWorkspaces.length > 0) {
          const nextWorkspace = chooseWorkspace(loadedWorkspaces);
          persistCurrentWorkspace(nextWorkspace);
          setWorkspace(nextWorkspace);
        }

        const loadedOrganizations = await fetchOrganizations();
        if (cancelled) {
          return;
        }

        if (loadedOrganizations.length > 0) {
          const nextOrganization = chooseOrganization(loadedOrganizations);
          persistCurrentOrganization(nextOrganization);
          setOrganization(nextOrganization);
        }

        const loadedProjects = await fetchProjects();
        if (cancelled) {
          return;
        }

        if (loadedProjects.length > 0) {
          const normalizedProjects = normalizeProjects(loadedProjects);
          const nextProjectEnv = chooseProjectEnv(normalizedProjects);
          saveCurrentProjectEnv(nextProjectEnv);
          setProjects(normalizedProjects);
          setCurrentProjectEnv(nextProjectEnv);
        }
      } catch {
        if (!cancelled) {
          setProjects(normalizeProjects(fallbackProjects));
        }
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar lang={lang} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-5">
            <ContextBar
              workspace={workspace}
              organization={organization}
              currentProjectEnv={currentProjectEnv}
              projects={projects}
              setCurrentProjectEnv={setCurrentProjectEnv}
            />
            <PlanBadge lang={lang} workspace={workspace} />
          </header>
          <main className="min-h-0 flex-1 bg-muted/30 p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function LayoutPlaceholder() {
  return <EmptyWorkspace />;
}
