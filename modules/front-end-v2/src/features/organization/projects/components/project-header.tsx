import { Copy, Edit, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ProjectEnv } from "@/features/layout/layout-types"
import type { OrganizationProject } from "@/features/organization/projects/projects-api"
import { IconTooltip } from "./inventory-shared"

export function ProjectHeader({
  project,
  currentProjectEnv,
  onCopyText,
  onCreateEnvironment,
  onEditProject,
  onDeleteProject,
}: {
  project: OrganizationProject
  currentProjectEnv: ProjectEnv | null
  onCopyText: (value: string) => void
  onCreateEnvironment: (project: OrganizationProject) => void
  onEditProject: (project: OrganizationProject) => void
  onDeleteProject: (project: OrganizationProject) => void
}) {
  const { t } = useTranslation()
  const isCurrent = project.id === currentProjectEnv?.projectId

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-sm font-semibold">{project.name}</h2>
        {isCurrent ? (
          <Badge className="bg-foreground text-background hover:bg-foreground">
            {t("organization.projects.currentProject")}
          </Badge>
        ) : null}
        <Badge variant="outline" className="max-w-48 truncate font-normal">
          {t("organization.projects.key", { key: project.key })}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 px-1.5"
          aria-label={t("organization.projects.actions.copyProjectKey")}
          onClick={() => onCopyText(project.key)}
        >
          <Copy className="size-3" />
          {t("organization.projects.actions.copyKey")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 px-1.5"
          aria-label={t("organization.projects.actions.copyProjectId")}
          onClick={() => onCopyText(project.id)}
        >
          <Copy className="size-3" />
          {t("organization.projects.actions.copyId")}
        </Button>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("organization.projects.environmentCount", {
            count: project.environments.length,
          })}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCreateEnvironment(project)}
        >
          <Plus className="size-3.5" />
          {t("organization.projects.actions.addEnvironment")}
        </Button>
        <IconTooltip label={t("organization.projects.actions.editProject")}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("organization.projects.actions.editProject")}
            onClick={() => onEditProject(project)}
          >
            <Edit className="size-3.5" />
          </Button>
        </IconTooltip>
        <IconTooltip label={t("organization.projects.actions.deleteProject")}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("organization.projects.actions.deleteProject")}
            disabled={isCurrent}
            onClick={() => onDeleteProject(project)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </IconTooltip>
      </div>
    </div>
  )
}
