import { ArrowLeft, Building2, ChevronRight, Loader2, LogOut, Search, TriangleAlert, Boxes } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { signOut, getStoredUserProfile } from "@/features/auth/auth-api";
import { AuthHeader } from "@/features/auth/auth-header";
import {
  clearCurrentProjectEnv,
  fetchOrganizations,
  fetchWorkspaces,
  getStoredWorkspace,
  joinCurrentOrganizationIfSsoFirstLogin,
  persistCurrentOrganization,
  persistCurrentWorkspace,
  resolveLang,
  type Organization,
  type Workspace
} from "@/features/layout/context";
import { cn } from "@/lib/utils";

type SelectionStep = "workspace" | "organization";

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.trim().toLowerCase());
}

function SelectionLoading() {
  return (
    <div className="flex min-h-[18rem] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading...
    </div>
  );
}

export function SelectWorkspacePage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const lang = resolveLang(params.lang);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const profile = getStoredUserProfile();
  const [step, setStep] = useState<SelectionStep>("workspace");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [search, setSearch] = useState("");
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [joiningOrganizationId, setJoiningOrganizationId] = useState("");
  const [error, setError] = useState("");

  const selectOrganization = useCallback(async (organization: Organization) => {
    setError("");
    setJoiningOrganizationId(organization.id);
    persistCurrentOrganization(organization);
    clearCurrentProjectEnv();

    try {
      await joinCurrentOrganizationIfSsoFirstLogin();
      const redirectUrl = localStorage.getItem("login-redirect-url");
      if (redirectUrl) {
        localStorage.removeItem("login-redirect-url");
        navigate(redirectUrl, { replace: true });
        return;
      }

      navigate(`/${lang}`, { replace: true });
    } catch {
      setError(t("selectWorkspace.errors.joinOrganization"));
      setJoiningOrganizationId("");
    }
  }, [lang, navigate, t]);

  const selectWorkspace = useCallback(async (workspace: Workspace, options?: { silent?: boolean }) => {
    setError("");
    setSearch("");
    setSelectedWorkspace(workspace);
    setLoadingOrganizations(true);
    persistCurrentWorkspace(workspace);

    try {
      const loadedOrganizations = await fetchOrganizations();
      setOrganizations(loadedOrganizations);
      setStep("organization");

      if (loadedOrganizations.length === 1) {
        await selectOrganization(loadedOrganizations[0]);
      }
    } catch {
      setOrganizations([]);
      setStep("organization");
      if (!options?.silent) {
        setError(t("selectWorkspace.errors.loadOrganizations"));
      }
    } finally {
      setLoadingOrganizations(false);
    }
  }, [selectOrganization, setSearch, t]);

  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [i18n, lang]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      try {
        const loadedWorkspaces = await fetchWorkspaces();
        if (cancelled) {
          return;
        }

        setWorkspaces(loadedWorkspaces);
        if (loadedWorkspaces.length === 0) {
          signOut();
          navigate(`/${lang}/login`, { replace: true });
          return;
        }

        const storedWorkspace = getStoredWorkspace();
        const shouldOpenOrganizationStep = searchParams.get("step") === "organization";
        const workspace =
          loadedWorkspaces.length === 1
            ? loadedWorkspaces[0]
            : shouldOpenOrganizationStep
              ? loadedWorkspaces.find((item) => item.id === storedWorkspace?.id)
              : undefined;

        if (workspace) {
          await selectWorkspace(workspace, { silent: true });
        }
      } catch {
        if (!cancelled) {
          setError(t("selectWorkspace.errors.loadWorkspaces"));
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspaces(false);
        }
      }
    }

    void loadWorkspaces();

    return () => {
      cancelled = true;
    };
  }, [lang, navigate, searchParams, selectWorkspace, t]);

  const filteredWorkspaces = useMemo(
    () => workspaces.filter((workspace) => matchesSearch(`${workspace.name} ${workspace.key}`, search)),
    [search, workspaces]
  );

  const filteredOrganizations = useMemo(
    () => organizations.filter((organization) => matchesSearch(`${organization.name} ${organization.key}`, search)),
    [organizations, search]
  );

  function backToWorkspaceSelection() {
    setStep("workspace");
    setOrganizations([]);
    setSelectedWorkspace(null);
    setSearch("");
  }

  function signInWithAnotherEmail() {
    signOut();
    navigate(`/${lang}/login`, { replace: true });
  }

  const title = step === "workspace" ? t("selectWorkspace.workspace.title") : t("selectWorkspace.organization.title");
  const subtitle = step === "workspace"
    ? t("selectWorkspace.workspace.subtitle", { email: profile.email ?? "" })
    : t("selectWorkspace.organization.subtitle", { email: profile.email ?? "" });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AuthHeader lang={lang} />
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/30 px-4 py-10">
        <div className="w-full max-w-[640px] rounded-md border border-border bg-card p-8 shadow-sm">
          {loadingWorkspaces ? (
            <SelectionLoading />
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {subtitle}
                  {step === "organization" && selectedWorkspace ? (
                    <span className="ml-2 inline-flex rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {selectedWorkspace.name}
                    </span>
                  ) : null}
                </p>
              </div>

              {error ? (
                <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              ) : null}

              {step === "workspace" ? (
                <SelectionList
                  search={search}
                  setSearch={setSearch}
                  searchPlaceholder={t("selectWorkspace.workspace.search")}
                  emptyText={t("selectWorkspace.workspace.empty")}
                >
                  {filteredWorkspaces.map((workspace) => (
                    <SelectionItem
                      key={workspace.id}
                      icon={<Building2 className="h-5 w-5" />}
                      title={workspace.name}
                      subtitle={workspace.key}
                      loading={loadingOrganizations && selectedWorkspace?.id === workspace.id}
                      disabled={loadingOrganizations && selectedWorkspace?.id !== workspace.id}
                      onClick={() => void selectWorkspace(workspace)}
                    />
                  ))}
                </SelectionList>
              ) : loadingOrganizations ? (
                <SelectionLoading />
              ) : organizations.length === 0 ? (
                <div className="mt-8 flex flex-col items-center rounded-md border border-dashed border-border px-6 py-10 text-center">
                  <TriangleAlert className="h-10 w-10 text-amber-600" />
                  <h2 className="mt-4 text-lg font-semibold">{t("selectWorkspace.organization.noneTitle")}</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("selectWorkspace.organization.noneDescription")}</p>
                </div>
              ) : (
                <SelectionList
                  search={search}
                  setSearch={setSearch}
                  searchPlaceholder={t("selectWorkspace.organization.search")}
                  emptyText={t("selectWorkspace.organization.empty")}
                >
                  {filteredOrganizations.map((organization) => (
                    <SelectionItem
                      key={organization.id}
                      icon={<Boxes className="h-5 w-5" />}
                      title={organization.name}
                      subtitle={organization.key}
                      loading={joiningOrganizationId === organization.id}
                      disabled={Boolean(joiningOrganizationId && joiningOrganizationId !== organization.id)}
                      onClick={() => void selectOrganization(organization)}
                    />
                  ))}
                </SelectionList>
              )}

              <div className="mt-7 flex items-center justify-between gap-3">
                {step === "organization" && workspaces.length > 1 ? (
                  <Button type="button" variant="ghost" className="px-0" onClick={backToWorkspaceSelection}>
                    <ArrowLeft className="h-4 w-4" />
                    {t("selectWorkspace.backToWorkspaces")}
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" variant="ghost" onClick={signInWithAnotherEmail}>
                  <LogOut className="h-4 w-4" />
                  {t("selectWorkspace.signInWithAnotherEmail")}
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function SelectionList({
  search,
  setSearch,
  searchPlaceholder,
  emptyText,
  children
}: {
  search: string;
  setSearch: (value: string) => void;
  searchPlaceholder: string;
  emptyText: string;
  children: ReactNode;
}) {
  const isEmpty = Array.isArray(children) && children.length === 0;

  return (
    <div className="mt-6">
      <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={search}
          placeholder={searchPlaceholder}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="mt-3 max-h-[22rem] overflow-y-auto rounded-md border border-border">
        {isEmpty ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyText}</div> : children}
      </div>
    </div>
  );
}

function SelectionItem({
  icon,
  title,
  subtitle,
  loading,
  disabled,
  onClick
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent",
        disabled && "pointer-events-none cursor-default opacity-50"
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}
