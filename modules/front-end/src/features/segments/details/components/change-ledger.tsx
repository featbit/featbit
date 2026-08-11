import { ChangeLedger as SharedChangeLedger } from "@/features/change-review/change-ledger"
import type { ChangeLedgerLayout } from "@/features/change-review/change-review-types"
import type { ReviewChange } from "../segment-details-utils"
import { useSegmentChangeLedgerAdapter } from "./segment-change-ledger-adapter"

export function ChangeLedger({
  changes,
  layout,
  className,
}: {
  changes: ReviewChange[]
  layout: ChangeLedgerLayout
  className?: string
}) {
  const adapter = useSegmentChangeLedgerAdapter()
  return (
    <SharedChangeLedger
      changes={changes}
      layout={layout}
      className={className}
      {...adapter}
    />
  )
}
