export type ChangeRequestStatus =
  "PendingReview" | "Approved" | "Declined" | "Applied"

export type ChangeRequestAction = "approve" | "decline" | "apply"

export type ChangeRequestMember = {
  id: string
  name: string
  email: string
}

export type ChangeRequestReviewer = {
  memberId: string
  name?: string
  email?: string
  action: string
  timestamp?: string | null
}

export type ChangeRequestItem = {
  id: string
  flagId: string
  flagName: string
  flagKey: string
  reason: string
  status: ChangeRequestStatus
  creatorId: string
  creatorName: string
  creatorEmail: string
  createdAt: string
  updatedAt: string
  dataChange: { previous?: string; current?: string }
  instructions: Array<{ kind: string; value: unknown }>
  reviewers: ChangeRequestReviewer[]
  canReview: boolean
  canApply: boolean
}

export type ChangeRequestPage = {
  items: ChangeRequestItem[]
  totalCount: number
  needsReviewCount: number
}

export type ChangeRequestFilters = {
  query: string
  creatorId?: string
  reviewerId?: string
  status?: ChangeRequestStatus
}
