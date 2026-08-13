import type { QueryClient } from "@tanstack/react-query"
import type { RelationshipOptionPage } from "../team-api"

export type RelationshipOptionsLoader = (
  query: string,
  pageIndex: number
) => Promise<RelationshipOptionPage>

const relationshipOptionsRootKey = ["iam", "relationship-options"] as const
const relationshipOptionsStaleTime = 30_000

function relationshipOptionsQueryKey(cacheKey: string, query: string) {
  return [...relationshipOptionsRootKey, cacheKey, query, 0] as const
}

function relationshipOptionsQuery(
  cacheKey: string,
  query: string,
  loadOptions: RelationshipOptionsLoader
) {
  return {
    queryKey: relationshipOptionsQueryKey(cacheKey, query),
    queryFn: () => loadOptions(query, 0),
    staleTime: relationshipOptionsStaleTime,
  }
}

export function getCachedRelationshipOptions(
  queryClient: QueryClient,
  cacheKey: string,
  query: string
) {
  const state = queryClient.getQueryState<RelationshipOptionPage>(
    relationshipOptionsQueryKey(cacheKey, query)
  )
  if (
    !state?.data ||
    Date.now() - state.dataUpdatedAt >= relationshipOptionsStaleTime
  ) {
    return undefined
  }
  return state.data
}

export function fetchRelationshipOptions(
  queryClient: QueryClient,
  cacheKey: string,
  query: string,
  loadOptions: RelationshipOptionsLoader
) {
  return queryClient.fetchQuery(
    relationshipOptionsQuery(cacheKey, query, loadOptions)
  )
}

export function prefetchRelationshipOptions(
  queryClient: QueryClient,
  cacheKey: string,
  loadOptions: RelationshipOptionsLoader
) {
  return queryClient.prefetchQuery(
    relationshipOptionsQuery(cacheKey, "", loadOptions)
  )
}

export function clearRelationshipOptionsCache(
  queryClient: QueryClient,
  cacheKey: string
) {
  queryClient.removeQueries({
    queryKey: [...relationshipOptionsRootKey, cacheKey],
  })
}
