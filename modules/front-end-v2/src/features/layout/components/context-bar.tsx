import { ChevronsUpDown, Settings } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { EnvironmentSecretsPopover } from "@/features/layout/components/environment-secrets-popover"
import {
  localizedPath,
  projectEnvFromSelection,
  resolveLang,
} from "@/features/layout/layout-context"
import type {
  Organization,
  Project,
  ProjectEnv,
} from "@/features/layout/layout-types"

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
  const [environmentOpen, setEnvironmentOpen] = useState(false)
  const [secretsOpen, setSecretsOpen] = useState(false)
  const [search, setSearch] = useState("")

  const orderedProjects = useMemo(() => {
    const availableProjects = projects.filter(
      (project) => project.environments.length > 0
    )
    const currentProject = availableProjects.find(
      (project) => project.id === currentProjectEnv?.projectId
    )

    if (!currentProject) {
      return availableProjects
    }

    return [
      currentProject,
      ...availableProjects.filter(
        (project) => project.id !== currentProject.id
      ),
    ]
  }, [currentProjectEnv?.projectId, projects])

  const currentEnvironment = useMemo(() => {
    const currentProject = projects.find(
      (project) => project.id === currentProjectEnv?.projectId
    )

    return currentProject?.environments.find(
      (environment) => environment.id === currentProjectEnv?.envId
    )
  }, [currentProjectEnv?.envId, currentProjectEnv?.projectId, projects])

  const manageSecretsHref = useMemo(() => {
    const projectsPath = localizedPath(lang, "/organization/projects")

    if (!currentProjectEnv) {
      return projectsPath
    }

    const searchParams = new URLSearchParams({
      view: "secrets",
      projectId: currentProjectEnv.projectId,
      environmentId: currentProjectEnv.envId,
    })

    return `${projectsPath}?${searchParams.toString()}`
  }, [currentProjectEnv, lang])

  function handleEnvironmentOpenChange(nextOpen: boolean) {
    setEnvironmentOpen(nextOpen)
    if (nextOpen) {
      setSecretsOpen(false)
    }
    if (!nextOpen) {
      setSearch("")
    }
  }

  function handleSecretsOpenChange(nextOpen: boolean) {
    setSecretsOpen(nextOpen)
    if (nextOpen) {
      setEnvironmentOpen(false)
      setSearch("")
    }
  }

  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2 text-sm">
      <span className="truncate font-medium">{organization?.name ?? ""}</span>
      <span className="text-muted-foreground">/</span>
      <span className="truncate font-medium">
        {currentProjectEnv?.projectName ?? ""}
      </span>
      <span className="text-muted-foreground">/</span>
      <Popover
        open={environmentOpen}
        onOpenChange={handleEnvironmentOpenChange}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-8 gap-2 px-2"
              aria-expanded={environmentOpen}
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
          <Command className="h-auto w-full rounded-lg p-0 [&_[data-slot=command-input-wrapper]]:p-0">
            <div className="p-3">
              <CommandInput
                value={search}
                placeholder={t("layout.context.searchEnvironments")}
                onValueChange={setSearch}
              />
            </div>
            <CommandList className="max-h-72 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              <CommandEmpty>{t("layout.context.noEnvironments")}</CommandEmpty>
              {orderedProjects.map((project) => {
                const isCurrentProject =
                  project.id === currentProjectEnv?.projectId

                return (
                  <CommandGroup
                    key={project.id}
                    heading={`${project.name}${
                      isCurrentProject
                        ? ` · ${t("layout.context.currentProject")}`
                        : ""
                    }`}
                    className="[&_[cmdk-group-items]]:space-y-1"
                  >
                    {project.environments.map((environment) => {
                      const selected =
                        isCurrentProject &&
                        environment.id === currentProjectEnv?.envId

                      return (
                        <CommandItem
                          key={`${project.id}:${environment.id}`}
                          value={`${project.name} ${project.key} ${environment.name} ${environment.key} ${project.id} ${environment.id}`}
                          data-checked={selected}
                          className="h-9 rounded-md px-3 py-0 leading-none data-[checked=true]:bg-accent data-[checked=true]:text-accent-foreground"
                          onSelect={() => {
                            const nextProjectEnv = projectEnvFromSelection(
                              project,
                              environment
                            )
                            onProjectEnvChange(nextProjectEnv)
                            handleEnvironmentOpenChange(false)
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {environment.name}
                          </span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </Command>
          <div className="mx-3 h-px bg-border" />
          <Button
            nativeButton={false}
            variant="ghost"
            className="m-3 mt-2 h-9 w-[calc(100%-1.5rem)] justify-start gap-2 px-2 text-muted-foreground"
            render={<Link to={localizedPath(lang, "/organization/projects")} />}
            onClick={() => handleEnvironmentOpenChange(false)}
          >
            <Settings className="size-4" />
            {t("layout.context.manageEnvironments")}
          </Button>
        </PopoverContent>
      </Popover>
      <EnvironmentSecretsPopover
        open={secretsOpen}
        onOpenChange={handleSecretsOpenChange}
        projectName={currentProjectEnv?.projectName ?? ""}
        environmentName={currentProjectEnv?.envName ?? ""}
        secrets={currentEnvironment?.secrets ?? []}
        manageHref={manageSecretsHref}
        disabled={!currentEnvironment}
      />
    </div>
  )
}
