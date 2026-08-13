import { ArrowUpDown, Copy, Edit, Info, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ProjectEnv } from "@/features/layout/layout-types"
import type {
  OrganizationProject,
  ProjectEnvironment,
} from "@/features/organization/projects/projects-api"
import { cn } from "@/lib/utils"
import { IconTooltip } from "./inventory-shared"
import { SecretsCell } from "./secrets-cell"

export type EnvironmentSort = {
  field: "name" | "key"
  direction: "asc" | "desc"
} | null

function SortableHeader({
  label,
  field,
  sort,
  onToggle,
}: {
  label: string
  field: NonNullable<EnvironmentSort>["field"]
  sort: EnvironmentSort
  onToggle: (field: NonNullable<EnvironmentSort>["field"]) => void
}) {
  const active = sort?.field === field

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="-ml-2 h-7 px-2 font-medium"
      onClick={() => onToggle(field)}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "size-3 text-muted-foreground",
          active && "text-foreground"
        )}
      />
    </Button>
  )
}

function sortEnvironments(
  environments: ProjectEnvironment[],
  sort: EnvironmentSort
) {
  if (!sort) {
    return environments
  }

  return [...environments].sort((a, b) => {
    const result = a[sort.field].localeCompare(b[sort.field], undefined, {
      sensitivity: "base",
    })

    return sort.direction === "asc" ? result : -result
  })
}

export function EnvironmentTable({
  project,
  currentProjectEnv,
  sort,
  canCreateEnvironment,
  canUpdateEnvironment,
  canDeleteEnvironment,
  canCreateSecret,
  onToggleSort,
  onCreateEnvironment,
  onEditEnvironment,
  onDeleteEnvironment,
  onAddSecret,
  onCopyText,
  onCopySecret,
  onViewSecrets,
}: {
  project: OrganizationProject
  currentProjectEnv: ProjectEnv | null
  sort: EnvironmentSort
  canCreateEnvironment: boolean
  canUpdateEnvironment: (
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) => boolean
  canDeleteEnvironment: (
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) => boolean
  canCreateSecret: (
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) => boolean
  onToggleSort: (field: NonNullable<EnvironmentSort>["field"]) => void
  onCreateEnvironment: (project: OrganizationProject) => void
  onEditEnvironment: (
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) => void
  onDeleteEnvironment: (
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) => void
  onAddSecret: (environment: ProjectEnvironment) => void
  onCopyText: (value: string) => void
  onCopySecret: (value: string) => void
  onViewSecrets: (
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) => void
}) {
  const { t } = useTranslation()

  return (
    <Table className="min-w-[1060px] table-fixed">
      <TableHeader className="bg-muted/40 text-left text-foreground">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[180px] px-4 py-2.5 font-medium">
            <SortableHeader
              label={t("organization.projects.columns.environment")}
              field="name"
              sort={sort}
              onToggle={onToggleSort}
            />
          </TableHead>
          <TableHead className="w-[140px] px-4 py-2.5 font-medium">
            <SortableHeader
              label={t("organization.projects.columns.key")}
              field="key"
              sort={sort}
              onToggle={onToggleSort}
            />
          </TableHead>
          <TableHead className="w-[210px] px-4 py-2.5 font-medium">
            {t("organization.projects.columns.description")}
          </TableHead>
          <TableHead className="w-[190px] px-4 py-2.5 font-medium">
            <span className="inline-flex items-center gap-1">
              {t("organization.projects.columns.requireChangeComment")}
              <IconTooltip
                label={t("organization.projects.helper.requireChangeComment")}
              >
                <Info className="size-3.5 text-muted-foreground" />
              </IconTooltip>
            </span>
          </TableHead>
          <TableHead className="w-[260px] px-4 py-2.5 font-medium">
            {t("organization.projects.columns.secrets")}
          </TableHead>
          <TableHead className="w-[150px] px-4 py-2.5 text-right font-medium">
            {t("organization.projects.columns.actions")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {project.environments.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="px-4 py-4">
              {canCreateEnvironment ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onCreateEnvironment(project)}
                >
                  <Plus className="size-3.5" />
                  {t("organization.projects.actions.addEnvironment")}
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ) : (
          sortEnvironments(project.environments, sort).map((environment) => {
            const isCurrent = environment.id === currentProjectEnv?.envId

            return (
              <TableRow key={environment.id}>
                <TableCell className="px-4 py-2.5 align-middle">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">
                      {environment.name}
                    </span>
                    {isCurrent ? (
                      <Badge className="bg-foreground text-background hover:bg-foreground">
                        {t("organization.projects.currentEnvironment")}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="truncate px-4 py-2.5 align-middle">
                  {environment.key}
                </TableCell>
                <TableCell className="px-4 py-2.5 align-middle">
                  {environment.description ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger
                          render={<span className="block truncate" />}
                        >
                          {environment.description}
                        </TooltipTrigger>
                        <TooltipContent>
                          {environment.description}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    t("organization.projects.noDescription")
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5 align-middle">
                  <Badge
                    variant="outline"
                    className={cn(
                      environment.settings.requireChangeComment && "bg-muted/50"
                    )}
                  >
                    {environment.settings.requireChangeComment
                      ? t("organization.projects.enabled")
                      : t("organization.projects.disabled")}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-2.5 align-middle">
                  <SecretsCell
                    environment={environment}
                    canAddSecret={canCreateSecret(project, environment)}
                    onAddSecret={onAddSecret}
                    onCopySecret={onCopySecret}
                    onViewSecrets={(selectedEnvironment) =>
                      onViewSecrets(project, selectedEnvironment)
                    }
                  />
                </TableCell>
                <TableCell className="px-4 py-2.5 align-middle">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-6 px-1.5"
                      aria-label={t(
                        "organization.projects.actions.copyEnvironmentId"
                      )}
                      onClick={() => onCopyText(environment.id)}
                    >
                      <Copy className="size-3" />
                      {t("organization.projects.actions.copyId")}
                    </Button>
                    {canUpdateEnvironment(project, environment) ? (
                      <IconTooltip
                        label={t(
                          "organization.projects.actions.editEnvironment"
                        )}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t(
                            "organization.projects.actions.editEnvironment"
                          )}
                          onClick={() =>
                            onEditEnvironment(project, environment)
                          }
                        >
                          <Edit className="size-3" />
                        </Button>
                      </IconTooltip>
                    ) : null}
                    {canDeleteEnvironment(project, environment) ? (
                      <IconTooltip
                        label={t(
                          "organization.projects.actions.deleteEnvironment"
                        )}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t(
                            "organization.projects.actions.deleteEnvironment"
                          )}
                          disabled={isCurrent}
                          onClick={() =>
                            onDeleteEnvironment(project, environment)
                          }
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </IconTooltip>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
