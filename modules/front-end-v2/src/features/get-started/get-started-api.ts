import { fetchProjects } from "@/features/layout/layout-context"
import type { GetStartedEnvironment } from "./get-started-types"

export async function fetchGetStartedEnvironment(
  projectId: string,
  envId: string
): Promise<GetStartedEnvironment> {
  const projects = await fetchProjects()
  const project = projects.find((item) => item.id === projectId)
  const environment = project?.environments.find((item) => item.id === envId)

  if (!project || !environment) {
    throw new Error("The selected environment is no longer available.")
  }

  return {
    id: environment.id,
    projectId: project.id,
    name: environment.name,
    key: environment.key ?? "",
    secrets: environment.secrets ?? [],
  }
}
