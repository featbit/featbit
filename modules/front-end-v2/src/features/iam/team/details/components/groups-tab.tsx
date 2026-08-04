import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { Lang } from "@/features/layout/layout-types"
import type { MemberDetailGroup } from "../../team-api"
import { DetailsDataTable } from "./details-data-table"
import { createGroupColumns } from "./group-columns"

export function GroupsTab({
  data,
  lang,
  loading,
  emptyMessage,
  emptyAction,
  onCopyResource,
  onRemove,
}: {
  data: MemberDetailGroup[]
  lang: Lang
  loading: boolean
  emptyMessage: string
  emptyAction?: { label: string; onClick: () => void }
  onCopyResource: (value: string) => void
  onRemove: (group: MemberDetailGroup) => void
}) {
  const { t } = useTranslation()
  const columns = useMemo(
    () =>
      createGroupColumns({
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
