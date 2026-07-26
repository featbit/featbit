import { ChangeReviewDialog } from "@/features/change-review/change-review-dialog"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import type { Lang } from "@/features/layout/layout-types"

export function FlagChangeReviewDialog({
  open,
  lang,
  flagName,
  changes,
  requireComment,
  saving,
  onOpenChange,
  onSave,
}: {
  open: boolean
  lang: Lang
  flagName: string
  changes: ChangeReviewItem[]
  requireComment: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (comment: string) => void
}) {
  const zh = lang === "zh"
  return (
    <ChangeReviewDialog
      open={open}
      idPrefix="flag-targeting"
      layout="targeting"
      changes={changes}
      requireComment={requireComment}
      saving={saving}
      copy={{
        title: zh ? "审核定向变更" : "Review targeting changes",
        description: zh
          ? `保存前审核 ${flagName} 的待处理变更。`
          : `Review the pending changes to ${flagName} before saving.`,
        changes: zh ? "变更" : "Changes",
        changeCount: (count) => (zh ? `${count} 项变更` : `${count} changes`),
        comment: zh ? "变更说明" : "Change comment",
        optional: zh ? "（可选）" : "(optional)",
        commentPlaceholder: zh
          ? "说明为什么需要此变更"
          : "Describe why this change is needed",
        commentHelp: zh
          ? "用于审计和变更追踪。"
          : "Used for auditing and change tracking.",
        cancel: zh ? "取消" : "Cancel",
        save: zh ? "保存变更" : "Save changes",
        saving: zh ? "保存中…" : "Saving…",
      }}
      ledger={{
        copy: {
          label: (change) => change.label,
          action: (action) =>
            ({
              added: zh ? "已添加" : "Added",
              removed: zh ? "已移除" : "Removed",
              updated: zh ? "已更新" : "Updated",
            })[action],
          actionCount: (action, count) =>
            `${action === "added" ? (zh ? "已添加" : "Added") : zh ? "已移除" : "Removed"} · ${count}`,
          showMore: (count) =>
            zh ? `再显示 ${count} 项` : `Show ${count} more`,
          showLess: zh ? "收起" : "Show less",
        },
      }}
      onOpenChange={onOpenChange}
      onSave={onSave}
    />
  )
}
