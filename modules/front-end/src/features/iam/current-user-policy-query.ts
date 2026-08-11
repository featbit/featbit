import { queryOptions } from "@tanstack/react-query"
import {
  fetchCurrentUserPolicies,
  type CurrentUserPolicy,
} from "./current-user-permissions"

export function currentUserPoliciesQueryKey(organizationId: string) {
  return ["current-user-policies", organizationId] as const
}

export function currentUserPoliciesQueryOptions<
  TPolicy extends CurrentUserPolicy = CurrentUserPolicy,
>(organizationId: string) {
  return queryOptions({
    queryKey: currentUserPoliciesQueryKey(organizationId),
    queryFn: () => fetchCurrentUserPolicies<TPolicy>(),
    enabled: Boolean(organizationId),
  })
}
