import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { Lang } from "@/features/layout/layout-types"
import type { MemberInheritedPolicy } from "../../team-api"
import { DetailsDataTable } from "./details-data-table"
import { createInheritedPolicyColumns } from "./inherited-policy-columns"

export function InheritedPoliciesTab({
  data,
  lang,
  loading,
  emptyMessage,
  onCopyResource,
}: {
  data: MemberInheritedPolicy[]
  lang: Lang
  loading: boolean
  emptyMessage: string
  onCopyResource: (value: string) => void
}) {
  const { t } = useTranslation()
  const columns = useMemo(
    () =>
      createInheritedPolicyColumns({
        t,
        lang,
        onCopyResource,
      }),
    [lang, onCopyResource, t]
  )

  return (
    <DetailsDataTable
      data={data}
      columns={columns}
      loading={loading}
      emptyMessage={emptyMessage}
    />
  )
}
