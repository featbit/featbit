import type { Segment, UserPolicy } from "./segments-types"
import {
  canUseAction,
  canUseAllActions,
  hasOwnerPolicy,
} from "@/features/iam/policy-matcher"

export type SegmentAction =
  | "CreateSegment"
  | "ArchiveSegment"
  | "RestoreSegment"
  | "DeleteSegment"
  | "UpdateSegmentName"
  | "UpdateSegmentDescription"
  | "UpdateSegmentTags"
  | "UpdateSegmentTargetingUsers"
  | "UpdateSegmentRules"

export function environmentRn(input: {
  projectKey: string
  environmentKey: string
}) {
  return `project/${input.projectKey}:env/${input.environmentKey}`
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
  action: SegmentAction,
  fineGrainedGranted: boolean
) {
  const actionAllowed = canUseAction(policies, resourceRn, action)

  return Boolean(
    actionAllowed &&
    (fineGrainedGranted ||
      hasOwnerPolicy(policies) ||
      canUseAllActions(policies, resourceRn))
  )
}
