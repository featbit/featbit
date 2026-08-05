import { fetchApi } from "@/lib/api/authenticated-api"
import {
  canUseAction,
  type Policy,
  type PolicyStatement,
} from "./policy-matcher"

export type CurrentUserPolicyStatement = PolicyStatement
export type CurrentUserPolicy = Policy

export { canUseAction }

export function fetchCurrentUserPolicies() {
  return fetchApi<CurrentUserPolicy[]>("/api/v1/user/policies")
}

export function projectRn(projectKey: string) {
  return `project/${projectKey}`
}

export function environmentRn(projectKey: string, environmentKey: string) {
  return `${projectRn(projectKey)}:env/${environmentKey}`
}
