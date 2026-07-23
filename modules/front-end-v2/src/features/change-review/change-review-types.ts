export type ChangeReviewAction = "added" | "removed" | "updated"

export type ChangeReviewValueGroup = {
  action: Extract<ChangeReviewAction, "added" | "removed">
  values: string[]
}

export type ChangeReviewItem = {
  kind: string
  label: string
  action?: ChangeReviewAction
  previous?: string
  current?: string
  values?: string[]
  valueGroups?: ChangeReviewValueGroup[]
  literalLabel?: boolean
}

export type ChangeLedgerLayout = "settings" | "targeting" | "history"
