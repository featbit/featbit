import { Plus, Search } from "lucide-react"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ProjectEnv } from "@/features/layout/layout-types"
import type {
  OrganizationProject,
  ProjectEnvironment,
} from "@/features/organization/projects/projects-api"
import {
  EnvironmentTable,
  type EnvironmentSort,
} from "./environment-table"
import { ProjectHeader } from "./project-header"
export { SecretsSheet } from "./secrets-sheet"

type EnvironmentSortByProject = Record<string, EnvironmentSort>

const PROJECT_PAGE_SIZE = 20

export function ProjectInventory({
  projects,
  currentProjectEnv,
  search,
  loading,
  onSearchChange,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onCreateEnvironment,
  onEditEnvironment,
  onDeleteEnvironment,
  onAddSecret,
  onCopyText,
  onCopySecret,
  onViewSecrets,
}: {
  projects: OrganizationProject[]
  currentProjectEnv: ProjectEnv | null
  search: string
  loading: boolean
  onSearchChange: (value: string) => void
  onCreateProject: () => void
  onEditProject: (project: OrganizationProject) => void
  onDeleteProject: (project: OrganizationProject) => void
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
  const deferredSearch = useDeferredValue(search)
  const [visibleProjectCount, setVisibleProjectCount] =
    useState(PROJECT_PAGE_SIZE)
  const [environmentSortByProject, setEnvironmentSortByProject] =
    useState<EnvironmentSortByProject>({})
  const filteredProjects = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) {
      return projects
    }

    return projects.filter((project) => project.name.toLowerCase().includes(query))
  }, [deferredSearch, projects])
  const visibleProjects = useMemo(
    () => filteredProjects.slice(0, visibleProjectCount),
    [filteredProjects, visibleProjectCount]
  )
  const remainingProjectCount = Math.max(
    filteredProjects.length - visibleProjects.length,
    0
  )

  useEffect(() => {
    setVisibleProjectCount(PROJECT_PAGE_SIZE)
  }, [deferredSearch, projects.length])

  function toggleEnvironmentSort(
    projectId: string,
    field: NonNullable<EnvironmentSort>["field"]
  ) {
    setEnvironmentSortByProject((current) => {
      const currentSort = current[projectId]

      return {
        ...current,
        [projectId]:
          currentSort?.field === field
            ? {
                field,
                direction: currentSort.direction === "asc" ? "desc" : "asc",
              }
            : { field, direction: "asc" },
      }
    })
  }

  return (
    <div className="pt-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative w-[min(420px,100%)]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            className="pl-8"
            placeholder={t("organization.projects.search")}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Button type="button" onClick={onCreateProject}>
          <Plus className="size-4" />
          {t("organization.projects.actions.createProject")}
        </Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
            {t("organization.select.loading")}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-md border bg-background p-6 text-sm text-muted-foreground">
            {search
              ? t("organization.projects.emptySearch")
              : t("organization.projects.empty")}
          </div>
        ) : (
          visibleProjects.map((project) => {
            const environmentSort = environmentSortByProject[project.id] ?? null

            return (
              <div
                key={project.id}
                className="overflow-hidden rounded-md border bg-background"
              >
                <ProjectHeader
                  project={project}
                  currentProjectEnv={currentProjectEnv}
                  onCopyText={onCopyText}
                  onCreateEnvironment={onCreateEnvironment}
                  onEditProject={onEditProject}
                  onDeleteProject={onDeleteProject}
                />
                <EnvironmentTable
                  project={project}
                  currentProjectEnv={currentProjectEnv}
                  sort={environmentSort}
                  onToggleSort={(field) =>
                    toggleEnvironmentSort(project.id, field)
                  }
                  onCreateEnvironment={onCreateEnvironment}
                  onEditEnvironment={onEditEnvironment}
                  onDeleteEnvironment={onDeleteEnvironment}
                  onAddSecret={onAddSecret}
                  onCopyText={onCopyText}
                  onCopySecret={onCopySecret}
                  onViewSecrets={onViewSecrets}
                />
              </div>
            )
          })
        )}
      </div>
      {!loading && remainingProjectCount > 0 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t("organization.projects.visibleProjects", {
              visible: visibleProjects.length,
              total: filteredProjects.length,
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setVisibleProjectCount((current) => current + PROJECT_PAGE_SIZE)
            }
          >
            {t("organization.projects.actions.loadMoreProjects", {
              count: Math.min(remainingProjectCount, PROJECT_PAGE_SIZE),
            })}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
