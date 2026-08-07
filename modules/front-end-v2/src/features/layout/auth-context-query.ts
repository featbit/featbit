import { queryOptions } from "@tanstack/react-query"
import {
  fetchOrganizations,
  fetchProjects,
  fetchWorkspaces,
} from "@/features/layout/layout-context"

const AUTH_CONTEXT_STALE_TIME = 60_000

export const authContextQueryKeys = {
  all: ["authenticated-context"] as const,
  workspaces: (userId: string) =>
    [...authContextQueryKeys.all, "workspaces", userId] as const,
  organizations: (
    userId: string,
    workspaceId: string,
    isSsoFirstLogin: boolean
  ) =>
    [
      ...authContextQueryKeys.all,
      "organizations",
      userId,
      workspaceId,
      isSsoFirstLogin,
    ] as const,
  projects: (userId: string, organizationId: string) =>
    [...authContextQueryKeys.all, "projects", userId, organizationId] as const,
}

export function workspacesQueryOptions(userId: string) {
  return queryOptions({
    queryKey: authContextQueryKeys.workspaces(userId),
    queryFn: fetchWorkspaces,
    staleTime: AUTH_CONTEXT_STALE_TIME,
  })
}

export function organizationsQueryOptions(
  userId: string,
  workspaceId: string,
  isSsoFirstLogin: boolean
) {
  return queryOptions({
    queryKey: authContextQueryKeys.organizations(
      userId,
      workspaceId,
      isSsoFirstLogin
    ),
    queryFn: fetchOrganizations,
    staleTime: AUTH_CONTEXT_STALE_TIME,
  })
}

export function projectsQueryOptions(userId: string, organizationId: string) {
  return queryOptions({
    queryKey: authContextQueryKeys.projects(userId, organizationId),
    queryFn: fetchProjects,
    staleTime: AUTH_CONTEXT_STALE_TIME,
  })
}
