import type { FlagSortedBy } from "@/features/organization/organization-api"

export const flagSortOptions: { value: FlagSortedBy; labelKey: string }[] = [
  { value: "created_at", labelKey: "organization.options.flagSort.createdAt" },
  { value: "key", labelKey: "organization.options.flagSort.key" },
]
