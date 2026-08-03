import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { Lang } from "@/features/layout/layout-types"
import type { MemberDirectPolicy } from "../../team-api"
import { DetailsDataTable } from "./details-data-table"
import { createDirectPolicyColumns } from "./direct-policy-columns"

export function DirectPoliciesTab({
  data,
  lang,
  loading,
  emptyMessage,
  emptyAction,
  onCopyResource,
  onRemove,
}: {
  data: MemberDirectPolicy[]
  lang: Lang
  loading: boolean
  emptyMessage: string
  emptyAction?: { label: string; onClick: () => void }
  onCopyResource: (value: string) => void
  onRemove: (policy: MemberDirectPolicy) => void
}) {
  const { t } = useTranslation()
  const columns = useMemo(
    () =>
      createDirectPolicyColumns({
        t,
        lang,
        onCopyResource,
        onRemove,
      }),
    [lang, onCopyResource, onRemove, t]
  )

  return (
    <DetailsDataTable
      data={data}
      columns={columns}
      loading={loading}
      emptyMessage={emptyMessage}
      emptyAction={emptyAction}
    />
  )
}
