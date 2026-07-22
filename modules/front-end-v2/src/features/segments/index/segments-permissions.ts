import type { Segment, UserPolicy } from "./segments-types"

export type SegmentAction =
  "CreateSegment" | "ArchiveSegment" | "RestoreSegment" | "DeleteSegment"

function wildcardMatches(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`).test(value)
}

export function environmentRn(input: {
  organizationKey: string
  projectKey: string
  environmentKey: string
}) {
  return `organization/${input.organizationKey}:project/${input.projectKey}:env/${input.environmentKey}`
}

export function segmentRn(
  envRn: string,
  segment: Pick<Segment, "key" | "tags">
) {
  const tags = segment.tags?.length ? `;${segment.tags.join(",")}` : ""
  return `${envRn}:segment/${segment.key}${tags}`
}

export function canUseSegmentAction(
  policies: UserPolicy[],
  resourceRn: string,
  action: SegmentAction
) {
  if (policies.some((policy) => policy.type.toLowerCase() === "owner")) {
    return true
  }

  return policies.some((policy) =>
    policy.statements.some(
      (statement) =>
        statement.effect.toLowerCase() === "allow" &&
        (statement.resourceType === "segment" ||
          statement.resourceType === "*") &&
        statement.resources.some((resource) =>
          wildcardMatches(resource, resourceRn)
        ) &&
        (statement.actions.includes(action) ||
          statement.actions.includes("*") ||
          statement.actions.includes("SegmentAllActions"))
    )
  )
}
