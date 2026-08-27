import { fetchApi } from "@/lib/api/authenticated-api"

export type OnboardingPayload = {
  organizationName: string
  organizationKey: string
  projectName: string
  projectKey: string
  environments: string[]
}

export type CreatedExampleProject = {
  id: string
  name: string
  key: string
  environments: Array<{
    id: string
    name: string
    key: string
    projectId?: string
  }>
}

export async function completeOnboarding(payload: OnboardingPayload) {
  return fetchApi<boolean>("/api/v1/organizations/onboarding", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export async function createExampleProject(payload: {
  name: string
  key: string
}) {
  return fetchApi<CreatedExampleProject>("/api/v1/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}
