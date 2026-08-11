import type { ScopeResource } from "../../segments-types"

export const scopeResourceGroups: Array<{
  type: ScopeResource["type"]
  labelKey: string
}> = [
  {
    type: "organization",
    labelKey: "segments.scopes.groups.organization",
  },
  {
    type: "project",
    labelKey: "segments.scopes.groups.project",
  },
  {
    type: "env",
    labelKey: "segments.scopes.groups.environment",
  },
]
