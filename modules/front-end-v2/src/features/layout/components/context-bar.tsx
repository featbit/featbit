import { Check, ChevronsUpDown, Search, Settings } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  localizedPath,
  projectEnvFromSelection,
  resolveLang,
} from "@/features/layout/layout-context"
import type { Organization, Project, ProjectEnv } from "@/features/layout/layout-types"

export function ContextBar({
  organization,
  currentProjectEnv,
  projects,
  onProjectEnvChange,
}: {
  organization: Organization | null
  currentProjectEnv: ProjectEnv | null
  projects: Project[]
  onProjectEnvChange: (projectEnv: ProjectEnv) => void
}) {
  const { t } = useTranslation()
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const groupedProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return projects
      .map((project) => ({
        ...project,
        environments: project.environments.filter((environment) => {
          const haystack =
            `${project.name} ${project.key} ${environment.name} ${environment.key}`.toLowerCase()
          return haystack.includes(normalizedSearch)
        }),
      }))
      .filter((project) => project.environments.length > 0)
  }, [projects, search])

  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2 text-sm">
      <span className="truncate font-medium">{organization?.name ?? ""}</span>
      <span className="text-muted-foreground">/</span>
      <span className="truncate font-medium">
        {currentProjectEnv?.projectName ?? ""}
      </span>
      <span className="text-muted-foreground">/</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-8 gap-2 px-2"
              aria-expanded={open}
              disabled={!currentProjectEnv}
            >
              {currentProjectEnv?.envName ?? ""}
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </Button>
          }
        />
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-[19rem] rounded-lg border-border/80 p-0 shadow-lg"
        >
          <div className="p-3">
            <label className="relative block text-muted-foreground">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                value={search}
                placeholder={t("layout.context.searchEnvironments")}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="max-h-72 overflow-y-auto px-3 pb-1 pt-1">
            {groupedProjects.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("layout.context.noEnvironments")}
              </p>
            ) : null}
            {groupedProjects.map((project, index) => (
              <div
                key={project.id}
                className={index === 0 ? "pb-2" : "pb-2 pt-2"}
              >
                <p className="pb-2 text-xs font-medium leading-4 text-muted-foreground">
                  {project.name}
                </p>
                {project.environments.map((environment) => {
                  const selected =
                    project.id === currentProjectEnv?.projectId &&
                    environment.id === currentProjectEnv?.envId

                  return (
                    <button
                      key={`${project.id}:${environment.id}`}
                      type="button"
                      className={`flex h-9 w-full items-center rounded-md px-3 py-0 text-left text-sm leading-none hover:bg-accent ${
                        selected ? "bg-accent text-accent-foreground" : ""
                      }`}
                      onClick={() => {
                        const nextProjectEnv = projectEnvFromSelection(
                          project,
                          environment
                        )
                        onProjectEnvChange(nextProjectEnv)
                        setOpen(false)
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {environment.name}
                      </span>
                      {selected ? <Check className="size-4" /> : null}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="mx-3 h-px bg-border" />
          <Button
            variant="ghost"
            className="m-3 mt-2 h-9 w-[calc(100%-1.5rem)] justify-start gap-2 px-2 text-muted-foreground"
            render={<Link to={localizedPath(lang, "/organization/projects")} />}
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4" />
            {t("layout.context.manageEnvironments")}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
