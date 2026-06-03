"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import type {
  Environment,
  Organization,
  Project,
} from "@/lib/featbit-auth/types";
import { Building2, ChevronDown, FolderClosed, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface TriadButtonProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}

function TriadSegment({ icon, label, value, muted }: TriadButtonProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground flex items-center gap-1">
        {icon}
        <span>{label}</span>
      </span>
      <span className={cn("font-medium", muted && "text-muted-foreground")}>
        {value}
      </span>
    </div>
  );
}

function OrganizationSelector({
  organizations,
  current,
  onSelect,
  disabled,
}: {
  organizations: Organization[];
  current: Organization | null;
  onSelect: (org: Organization) => void;
  disabled?: boolean;
}) {
  if (organizations.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || organizations.length <= 1}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted disabled:opacity-60 disabled:cursor-default transition-colors"
      >
        <TriadSegment
          icon={<Building2 className="size-3.5" />}
          label="Org"
          value={current?.name ?? "—"}
          muted={!current}
        />
        {organizations.length > 1 && (
          <ChevronDown className="size-3 text-muted-foreground" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organization</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={current?.id}
            onValueChange={(id) => {
              const next = organizations.find((o) => o.id === id);
              if (next && next.id !== current?.id) onSelect(next);
            }}
          >
            {organizations.map((o) => (
              <DropdownMenuRadioItem key={o.id} value={o.id}>
                {o.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectSelector({
  projects,
  currentProject,
  onSelect,
  disabled,
}: {
  projects: Project[];
  currentProject: Project | null;
  onSelect: (projectId: string) => void;
  disabled?: boolean;
}) {
  if (projects.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || projects.length <= 1}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted disabled:opacity-60 disabled:cursor-default transition-colors"
      >
        <TriadSegment
          icon={<FolderClosed className="size-3.5" />}
          label="Project"
          value={currentProject?.name ?? "—"}
          muted={!currentProject}
        />
        {projects.length > 1 && (
          <ChevronDown className="size-3 text-muted-foreground" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Project</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={currentProject?.id}
            onValueChange={(id) => {
              if (id && id !== currentProject?.id) onSelect(id);
            }}
          >
            {projects.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id}>
                {p.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EnvSelector({
  environments,
  currentEnv,
  onSelect,
  disabled,
}: {
  environments: Environment[];
  currentEnv: Environment | null;
  onSelect: (envId: string) => void;
  disabled?: boolean;
}) {
  if (environments.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || environments.length <= 1}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted disabled:opacity-60 disabled:cursor-default transition-colors"
      >
        <TriadSegment
          icon={<Layers className="size-3.5" />}
          label="Env"
          value={currentEnv?.name ?? "—"}
          muted={!currentEnv}
        />
        {environments.length > 1 && (
          <ChevronDown className="size-3 text-muted-foreground" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Environment</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={currentEnv?.id}
            onValueChange={(id) => {
              if (id && id !== currentEnv?.id) onSelect(id);
            }}
          >
            {environments.map((e) => (
              <DropdownMenuRadioItem key={e.id} value={e.id}>
                {e.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkspaceSwitcher({
  className,
  readOnly = false,
}: {
  className?: string;
  readOnly?: boolean;
}) {
  const {
    organization,
    organizations,
    projects,
    currentProject,
    currentEnvironment,
    selectOrganization,
    selectProjectEnv,
  } = useAuth();
  const router = useRouter();
  const [isPending, setPending] = useState(false);

  if (organizations.length === 0) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Building2 className="size-3.5" />
        <span>Loading workspace…</span>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs",
          className,
        )}
        title="Switch workspace from the Experiments dashboard"
      >
        <TriadSegment
          icon={<Building2 className="size-3.5" />}
          label="Org"
          value={organization?.name ?? "—"}
          muted={!organization}
        />
        <span className="text-muted-foreground/40 select-none">/</span>
        <TriadSegment
          icon={<FolderClosed className="size-3.5" />}
          label="Project"
          value={currentProject?.name ?? "—"}
          muted={!currentProject}
        />
        <span className="text-muted-foreground/40 select-none">:</span>
        <TriadSegment
          icon={<Layers className="size-3.5" />}
          label="Env"
          value={currentEnvironment?.name ?? "—"}
          muted={!currentEnvironment}
        />
      </div>
    );
  }

  const scheduleRefresh = () => {
    setPending(true);
    setTimeout(() => {
      router.refresh();
      setPending(false);
    }, 0);
  };

  const handleOrgChange = (org: Organization) => {
    setPending(true);
    selectOrganization(org)
      .then(() => router.refresh())
      .finally(() => setPending(false));
  };

  const handleProjectChange = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const firstEnv = project?.environments[0];
    if (!project || !firstEnv) return;
    selectProjectEnv(project.id, firstEnv.id);
    scheduleRefresh();
  };

  const handleEnvChange = (envId: string) => {
    if (!currentProject) return;
    selectProjectEnv(currentProject.id, envId);
    scheduleRefresh();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-md border border-border bg-background px-1 py-0.5",
        className,
      )}
      data-pending={isPending || undefined}
    >
      <OrganizationSelector
        organizations={organizations}
        current={organization}
        onSelect={handleOrgChange}
        disabled={isPending}
      />
      <span className="text-muted-foreground/40 text-xs select-none">/</span>
      <ProjectSelector
        projects={projects}
        currentProject={currentProject}
        onSelect={handleProjectChange}
        disabled={isPending}
      />
      <span className="text-muted-foreground/40 text-xs select-none">:</span>
      <EnvSelector
        environments={currentProject?.environments || []}
        currentEnv={currentEnvironment}
        onSelect={handleEnvChange}
        disabled={isPending}
      />
    </div>
  );
}
