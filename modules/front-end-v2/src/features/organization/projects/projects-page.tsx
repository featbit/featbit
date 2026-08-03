import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  getCurrentOrganization,
  getCurrentProjectEnv,
  notifyProjectsChanged,
  resolveLang,
  saveCurrentProjectEnv,
} from "@/features/layout/layout-context"
import type { ProjectEnv } from "@/features/layout/layout-types"
import { OrganizationLayout } from "@/features/organization/components/organization-layout"
import { normalizeOrganization } from "@/features/organization/organization-api"
import {
  DeleteConfirmDialog,
  type DeleteTarget,
} from "@/features/organization/projects/components/delete-confirm-dialog"
import {
  EnvironmentSheet,
  ProjectSheet,
  SecretDialog,
  type SecretValues,
} from "@/features/organization/projects/components/project-forms"
import {
  ProjectInventory,
  SecretsSheet,
} from "@/features/organization/projects/components/project-inventory"
import {
  createEnvironment,
  createProject,
  createSecret,
  deleteEnvironment,
  deleteProject,
  deleteSecret,
  fetchOrganizationProjects,
  type EnvironmentPayload,
  type EnvironmentSecret,
  type OrganizationProject,
  type ProjectEnvironment,
  type ProjectPayload,
  updateEnvironment,
  updateProject,
  updateSecretName,
} from "@/features/organization/projects/projects-api"

type ProjectTarget = OrganizationProject | null
type EnvironmentTarget = {
  project: OrganizationProject
  environment: ProjectEnvironment | null
} | null
type SecretTarget = {
  environment: ProjectEnvironment
  secret: EnvironmentSecret | null
} | null

function projectEnvFromData(
  project: OrganizationProject,
  environment: ProjectEnvironment
): ProjectEnv {
  return {
    projectId: project.id,
    projectName: project.name,
    projectKey: project.key,
    envId: environment.id,
    envName: environment.name,
    envKey: environment.key,
  }
}

export function OrganizationProjectsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const lang = resolveLang(params.lang)
  const [projects, setProjects] = useState<OrganizationProject[]>([])
  const [currentProjectEnv, setCurrentProjectEnv] = useState<ProjectEnv | null>(
    () => getCurrentProjectEnv()
  )
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [projectTarget, setProjectTarget] = useState<ProjectTarget>(null)
  const [projectSheetOpen, setProjectSheetOpen] = useState(false)
  const [environmentTarget, setEnvironmentTarget] =
    useState<EnvironmentTarget>(null)
  const [environmentSheetOpen, setEnvironmentSheetOpen] = useState(false)
  const [secretTarget, setSecretTarget] = useState<SecretTarget>(null)
  const [secretDialogOpen, setSecretDialogOpen] = useState(false)
  const [secretsTarget, setSecretsTarget] = useState<EnvironmentTarget>(null)
  const [secretsSheetOpen, setSecretsSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const organization = useMemo(
    () => normalizeOrganization(getCurrentOrganization()),
    []
  )
  const linkedSecretsTarget = useMemo<EnvironmentTarget>(() => {
    if (searchParams.get("view") !== "secrets") {
      return null
    }

    const projectId = searchParams.get("projectId")
    const environmentId = searchParams.get("environmentId")
    const project = projects.find((item) => item.id === projectId)
    const environment = project?.environments.find(
      (item) => item.id === environmentId
    )

    return project && environment ? { project, environment } : null
  }, [projects, searchParams])

  function sortProjects(nextProjects: OrganizationProject[]) {
    const currentProjectId = currentProjectEnv?.projectId
    if (!currentProjectId) {
      return nextProjects
    }

    return [...nextProjects].sort((a, b) => {
      if (a.id === currentProjectId) {
        return -1
      }
      if (b.id === currentProjectId) {
        return 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  function showError(error: unknown) {
    toast.error(
      error instanceof Error ? error.message : t("organization.operationFailed")
    )
  }

  function replaceProject(project: OrganizationProject) {
    setProjects((current) =>
      sortProjects(
        current.map((item) =>
          item.id === project.id
            ? {
                ...item,
                ...project,
                key: project.key || item.key,
                environments: project.environments.length
                  ? project.environments
                  : item.environments,
              }
            : item
        )
      )
    )
  }

  function updateEnvironmentInState(environment: ProjectEnvironment) {
    let mergedEnvironment: ProjectEnvironment | null = null

    setProjects((current) =>
      sortProjects(
        current.map((project) =>
          project.id === environment.projectId
            ? {
                ...project,
                environments: project.environments.map((item) =>
                  item.id === environment.id
                    ? (mergedEnvironment = {
                        ...item,
                        ...environment,
                        key: environment.key || item.key,
                        secrets: environment.secrets.length
                          ? environment.secrets
                          : item.secrets,
                      })
                    : item
                ),
              }
            : project
        )
      )
    )
    setSecretsTarget((current) =>
      current?.environment?.id === environment.id
        ? { ...current, environment: mergedEnvironment ?? environment }
        : current
    )
    setSecretTarget((current) =>
      current?.environment?.id === environment.id
        ? { ...current, environment: mergedEnvironment ?? environment }
        : current
    )
  }

  function findEnvironment(environmentId: string) {
    for (const project of projects) {
      const environment = project.environments.find(
        (item) => item.id === environmentId
      )
      if (environment) {
        return environment
      }
    }

    return null
  }

  function copyText(value: string) {
    void navigator.clipboard.writeText(value)
    toast.success(t("organization.copied"))
  }

  useEffect(() => {
    let cancelled = false

    async function loadProjects() {
      setLoading(true)
      try {
        const loadedProjects = await fetchOrganizationProjects()
        if (cancelled) {
          return
        }
        setProjects(sortProjects(loadedProjects))
      } catch (error) {
        if (!cancelled) {
          showError(error)
          setProjects([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      cancelled = true
    }
  }, [])

  function openCreateProject() {
    setProjectTarget({ id: "", name: "", key: "", environments: [] })
    setProjectSheetOpen(true)
  }

  function openEditProject(project: OrganizationProject) {
    setProjectTarget(project)
    setProjectSheetOpen(true)
  }

  function openDeleteProject(project: OrganizationProject) {
    if (currentProjectEnv?.projectId === project.id) {
      toast.error(t("organization.projects.currentProjectDeleteBlocked"))
      return
    }

    setDeleteTarget({
      type: "project",
      title: t("organization.projects.confirm.removeProjectTitle"),
      description: t("organization.projects.confirm.removeProject", {
        name: project.name,
      }),
      onConfirm: () => removeProject(project),
    })
  }

  async function removeProject(project: OrganizationProject) {
    if (currentProjectEnv?.projectId === project.id) {
      toast.error(t("organization.projects.currentProjectDeleteBlocked"))
      return
    }

    setSaving(true)
    try {
      await deleteProject(project.id)
      setProjects((current) =>
        sortProjects(current.filter((item) => item.id !== project.id))
      )
      notifyProjectsChanged()
      setDeleteTarget(null)
      toast.success(t("organization.operationSucceeded"))
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  async function submitProject(values: ProjectPayload) {
    const isEditing = Boolean(projectTarget?.id)
    setSaving(true)
    try {
      if (isEditing && projectTarget) {
        const updatedProject = await updateProject(projectTarget.id, {
          name: values.name.trim(),
        })
        replaceProject(updatedProject)
        if (currentProjectEnv?.projectId === updatedProject.id) {
          const nextProjectEnv = {
            ...currentProjectEnv,
            projectName: updatedProject.name,
          }
          saveCurrentProjectEnv(nextProjectEnv)
          setCurrentProjectEnv(nextProjectEnv)
        }
        notifyProjectsChanged()
      } else {
        const createdProject = await createProject({
          name: values.name.trim(),
          key: values.key!.trim(),
        })
        setProjects((current) => sortProjects([createdProject, ...current]))
        notifyProjectsChanged()
      }
      setProjectSheetOpen(false)
      toast.success(t("organization.operationSucceeded"))
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  function openCreateEnvironment(project: OrganizationProject) {
    setEnvironmentTarget({
      project,
      environment: {
        id: "",
        projectId: project.id,
        name: "",
        key: "",
        description: "",
        secrets: [],
        settings: { requireChangeComment: false },
      },
    })
    setEnvironmentSheetOpen(true)
  }

  function openEditEnvironment(
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) {
    setEnvironmentTarget({ project, environment })
    setEnvironmentSheetOpen(true)
  }

  async function submitEnvironment(values: {
    name: string
    key: string
    description: string
    requireChangeComment: boolean
  }) {
    if (!environmentTarget) {
      return
    }

    const isEditing = Boolean(environmentTarget.environment?.id)
    const payload: EnvironmentPayload = {
      name: values.name.trim(),
      key: values.key.trim(),
      description: values.description.trim(),
      settings: {
        requireChangeComment: values.requireChangeComment,
      },
    }

    setSaving(true)
    try {
      if (isEditing && environmentTarget.environment) {
        const updatedEnvironment = await updateEnvironment(
          environmentTarget.project.id,
          environmentTarget.environment.id,
          {
            name: payload.name,
            description: payload.description,
            settings: payload.settings,
          }
        )
        const mergedEnvironment = {
          ...environmentTarget.environment,
          ...updatedEnvironment,
          key: updatedEnvironment.key || environmentTarget.environment.key,
          secrets: updatedEnvironment.secrets.length
            ? updatedEnvironment.secrets
            : environmentTarget.environment.secrets,
        }
        updateEnvironmentInState(mergedEnvironment)
        if (currentProjectEnv?.envId === updatedEnvironment.id) {
          const nextProjectEnv = projectEnvFromData(
            environmentTarget.project,
            mergedEnvironment
          )
          saveCurrentProjectEnv(nextProjectEnv)
          setCurrentProjectEnv(nextProjectEnv)
        }
        notifyProjectsChanged()
      } else {
        const createdEnvironment = await createEnvironment(
          environmentTarget.project.id,
          payload as Required<EnvironmentPayload>
        )
        setProjects((current) =>
          sortProjects(
            current.map((project) =>
              project.id === environmentTarget.project.id
                ? {
                    ...project,
                    environments: [...project.environments, createdEnvironment],
                  }
                : project
            )
          )
        )
        notifyProjectsChanged()
      }
      setEnvironmentSheetOpen(false)
      toast.success(t("organization.operationSucceeded"))
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  async function removeEnvironment(
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) {
    if (currentProjectEnv?.envId === environment.id) {
      toast.error(t("organization.projects.currentEnvironmentDeleteBlocked"))
      return
    }

    setSaving(true)
    try {
      await deleteEnvironment(project.id, environment.id)
      setProjects((current) =>
        sortProjects(
          current.map((item) =>
            item.id === project.id
              ? {
                  ...item,
                  environments: item.environments.filter(
                    (env) => env.id !== environment.id
                  ),
                }
              : item
          )
        )
      )
      notifyProjectsChanged()
      setDeleteTarget(null)
      toast.success(t("organization.operationSucceeded"))
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  function openDeleteEnvironment(
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) {
    if (currentProjectEnv?.envId === environment.id) {
      toast.error(t("organization.projects.currentEnvironmentDeleteBlocked"))
      return
    }

    setDeleteTarget({
      type: "environment",
      title: t("organization.projects.confirm.removeEnvironmentTitle"),
      description: t("organization.projects.confirm.removeEnvironment", {
        name: environment.name,
      }),
      onConfirm: () => removeEnvironment(project, environment),
    })
  }

  function openAddSecret(environment: ProjectEnvironment) {
    setSecretTarget({ environment, secret: null })
    setSecretDialogOpen(true)
  }

  function openEditSecret(secret: EnvironmentSecret) {
    if (!activeSecretsTarget?.environment) {
      return
    }
    setSecretTarget({ environment: activeSecretsTarget.environment, secret })
    setSecretDialogOpen(true)
  }

  async function submitSecret(values: SecretValues) {
    if (!secretTarget) {
      return
    }

    setSaving(true)
    try {
      if (secretTarget.secret) {
        const environment =
          findEnvironment(secretTarget.environment.id) ??
          secretTarget.environment
        await updateSecretName(
          environment.id,
          secretTarget.secret.id,
          values.name.trim()
        )
        updateEnvironmentInState({
          ...environment,
          secrets: environment.secrets.map((secret) =>
            secret.id === secretTarget.secret?.id
              ? { ...secret, name: values.name.trim() }
              : secret
          ),
        })
      } else {
        const createdSecret = await createSecret(secretTarget.environment.id, {
          name: values.name.trim(),
          type: values.type,
        })
        updateEnvironmentInState({
          ...secretTarget.environment,
          secrets: [...secretTarget.environment.secrets, createdSecret],
        })
      }
      setSecretDialogOpen(false)
      toast.success(t("organization.operationSucceeded"))
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  async function removeSecret(secret: EnvironmentSecret) {
    if (!activeSecretsTarget?.environment) {
      return
    }

    setSaving(true)
    try {
      const environment =
        findEnvironment(activeSecretsTarget.environment.id) ??
        activeSecretsTarget.environment
      await deleteSecret(environment.id, secret.id)
      updateEnvironmentInState({
        ...environment,
        secrets: environment.secrets.filter((item) => item.id !== secret.id),
      })
      setDeleteTarget(null)
      toast.success(t("organization.operationSucceeded"))
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  function openDeleteSecret(secret: EnvironmentSecret) {
    setDeleteTarget({
      type: "secret",
      title: t("organization.projects.confirm.removeSecretTitle"),
      description: t("organization.projects.confirm.removeSecret", {
        name: secret.name,
      }),
      onConfirm: () => removeSecret(secret),
    })
  }

  function viewSecrets(
    project: OrganizationProject,
    environment: ProjectEnvironment
  ) {
    setSecretsTarget({ project, environment })
    setSecretsSheetOpen(true)
  }

  function handleSecretsSheetOpenChange(open: boolean) {
    setSecretsSheetOpen(open)

    if (open || searchParams.get("view") !== "secrets") {
      return
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete("view")
    nextSearchParams.delete("projectId")
    nextSearchParams.delete("environmentId")
    setSearchParams(nextSearchParams, { replace: true })
  }

  const activeSecretsTarget = linkedSecretsTarget ?? secretsTarget

  const currentSecretsEnvironment = activeSecretsTarget?.environment
    ? (projects
        .find((project) => project.id === activeSecretsTarget.project.id)
        ?.environments.find(
          (env) => env.id === activeSecretsTarget.environment?.id
        ) ?? activeSecretsTarget.environment)
    : null
  const currentSecretsProject = activeSecretsTarget?.project ?? null

  return (
    <OrganizationLayout
      organization={organization}
      lang={lang}
      activeTab="projects"
    >
      <ProjectInventory
        projects={projects}
        currentProjectEnv={currentProjectEnv}
        search={search}
        loading={loading}
        onSearchChange={setSearch}
        onCreateProject={openCreateProject}
        onEditProject={openEditProject}
        onDeleteProject={openDeleteProject}
        onCreateEnvironment={openCreateEnvironment}
        onEditEnvironment={openEditEnvironment}
        onDeleteEnvironment={openDeleteEnvironment}
        onAddSecret={openAddSecret}
        onCopyText={copyText}
        onCopySecret={copyText}
        onViewSecrets={viewSecrets}
      />

      <ProjectSheet
        open={projectSheetOpen}
        project={projectTarget}
        saving={saving}
        onOpenChange={setProjectSheetOpen}
        onSubmit={submitProject}
      />

      <EnvironmentSheet
        open={environmentSheetOpen}
        environment={environmentTarget?.environment ?? null}
        saving={saving}
        onOpenChange={setEnvironmentSheetOpen}
        onSubmit={submitEnvironment}
      />

      <SecretsSheet
        open={secretsSheetOpen || linkedSecretsTarget !== null}
        project={currentSecretsProject}
        environment={currentSecretsEnvironment}
        onOpenChange={handleSecretsSheetOpenChange}
        onAddSecret={openAddSecret}
        onCopySecret={copyText}
        onEditSecret={openEditSecret}
        onDeleteSecret={openDeleteSecret}
      />

      <SecretDialog
        open={secretDialogOpen}
        secret={secretTarget?.secret ?? null}
        saving={saving}
        onOpenChange={setSecretDialogOpen}
        onSubmit={submitSecret}
      />

      <DeleteConfirmDialog
        target={deleteTarget}
        saving={saving}
        cancelLabel={t("organization.projects.actions.cancel")}
        deleteLabel={t("organization.projects.actions.delete")}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      />
    </OrganizationLayout>
  )
}
