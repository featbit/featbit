import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { RuleEditor } from "@/features/targeting/rule-editor"
import { useRuleDragPreview } from "@/features/targeting/rule-drag-preview"
import { UserPanel } from "@/features/targeting/user-panel"
import { updateSegmentTargeting } from "../../segments-api"
import type {
  Segment,
  SegmentEndUser,
  SegmentUserProperty,
} from "../../segments-types"
import { ChangeReviewDialog } from "../components/change-review-dialog"
import {
  cloneSegment,
  newId,
  normalizedRules,
  stableTargeting,
  targetingChanges,
} from "../segment-details-utils"

type Props = {
  envId: string
  segment: Segment
  users: Map<string, SegmentEndUser>
  properties: SegmentUserProperty[]
  requireComment: boolean
  canUpdateUsers: boolean
  canUpdateRules: boolean
  onSaved: (segment: Segment) => void
}

export function TargetingTab({
  envId,
  segment,
  users,
  properties,
  requireComment,
  canUpdateUsers,
  canUpdateRules,
  onSaved,
}: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(() => cloneSegment(segment))
  const [resolvedUsers, setResolvedUsers] = useState(users)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [dragRuleId, setDragRuleId] = useState<string | null>(null)
  const { startPreview, movePreview, removePreview } = useRuleDragPreview()

  const dirty = stableTargeting(draft) !== stableTargeting(segment)
  const changes = useMemo(
    () => targetingChanges(segment, draft),
    [draft, segment]
  )
  const saveMutation = useMutation({
    mutationFn: (comment: string) =>
      updateSegmentTargeting(envId, segment.id, {
        included: draft.included,
        excluded: draft.excluded,
        rules: normalizedRules(draft.rules),
        comment,
      }),
    onSuccess: () => {
      const saved = {
        ...cloneSegment(draft),
        rules: normalizedRules(draft.rules),
      }
      onSaved(saved)
      setReviewOpen(false)
      toast.success(t("segments.operationSucceeded"))
      void queryClient.invalidateQueries({ queryKey: ["segment-audit-logs"] })
    },
    onError: () => toast.error(t("segments.operationFailed")),
  })

  function resolveUser(user: SegmentEndUser) {
    setResolvedUsers((current) => new Map(current).set(user.keyId, user))
  }

  function moveRule(sourceId: string, targetId: string) {
    if (sourceId === targetId) return
    setDraft((current) => {
      const sourceIndex = current.rules.findIndex(
        (rule) => rule.id === sourceId
      )
      const targetIndex = current.rules.findIndex(
        (rule) => rule.id === targetId
      )
      if (sourceIndex < 0 || targetIndex < 0) return current

      const rules = [...current.rules]
      const [moved] = rules.splice(sourceIndex, 1)
      rules.splice(targetIndex, 0, moved)
      return { ...current, rules }
    })
  }

  function addRule() {
    setDraft((current) => ({
      ...current,
      rules: [
        ...current.rules,
        {
          id: newId(),
          name: t("segments.detailsPage.rules.defaultName", {
            count: current.rules.length + 1,
          }),
          conditions: [
            {
              id: newId(),
              property: "keyId",
              op: "Equal",
              value: "",
            },
          ],
        },
      ],
    }))
  }

  return (
    <div className="space-y-7 pt-4 pb-5">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium">
            {t("segments.detailsPage.targeting.usersTitle")}
          </h2>
          <div className="flex items-center gap-5">
            {dirty ? (
              <Button
                type="button"
                variant="outline"
                disabled={saveMutation.isPending}
                onClick={() => {
                  setDraft(cloneSegment(segment))
                  setDragRuleId(null)
                }}
              >
                {t("segments.detailsPage.discard")}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!canUpdateRules && !canUpdateUsers) {
                  toast.error(t("segments.permissionDenied"))
                  return
                }
                setReviewOpen(true)
              }}
            >
              {t("segments.detailsPage.reviewAndSave")}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <UserPanel
            title={t("segments.detailsPage.targeting.included")}
            envId={envId}
            shared={segment.type === "shared"}
            keys={draft.included}
            users={resolvedUsers}
            otherKeys={draft.excluded}
            disabled={!canUpdateUsers}
            density="compact"
            onChange={(included) =>
              setDraft((current) => ({ ...current, included }))
            }
            onResolved={resolveUser}
          />
          <UserPanel
            title={t("segments.detailsPage.targeting.excluded")}
            envId={envId}
            shared={segment.type === "shared"}
            keys={draft.excluded}
            users={resolvedUsers}
            otherKeys={draft.included}
            disabled={!canUpdateUsers}
            density="compact"
            onChange={(excluded) =>
              setDraft((current) => ({ ...current, excluded }))
            }
            onResolved={resolveUser}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">
            {t("segments.detailsPage.rules.title")}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canUpdateRules}
            onClick={addRule}
          >
            <Plus />
            {t("segments.detailsPage.rules.addRule")}
          </Button>
        </div>
        <div className="space-y-3">
          {draft.rules.map((rule, index) => (
            <div
              key={rule.id}
              data-rule-id={rule.id}
              data-rule-drag-container
              className={
                dragRuleId === rule.id
                  ? "opacity-35 transition-opacity"
                  : "transition-opacity"
              }
              onDragOver={(event) => {
                if (!canUpdateRules) return
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
              }}
              onDrop={(event) => {
                event.preventDefault()
                const sourceId =
                  event.dataTransfer.getData("text/plain") || dragRuleId
                if (sourceId) moveRule(sourceId, rule.id)
                removePreview()
                setDragRuleId(null)
              }}
            >
              <RuleEditor
                envId={envId}
                rule={rule}
                properties={properties}
                disabled={!canUpdateRules}
                canMoveUp={index > 0}
                canMoveDown={index < draft.rules.length - 1}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move"
                  event.dataTransfer.setData("text/plain", rule.id)
                  startPreview(event)
                  setDragRuleId(rule.id)
                }}
                onDrag={(event) => movePreview(event.clientX, event.clientY)}
                onDragEnd={() => {
                  removePreview()
                  setDragRuleId(null)
                }}
                onMoveUp={() => moveRule(rule.id, draft.rules[index - 1].id)}
                onMoveDown={() => moveRule(rule.id, draft.rules[index + 1].id)}
                onChange={(updated) =>
                  setDraft((current) => ({
                    ...current,
                    rules: current.rules.map((item) =>
                      item.id === rule.id ? updated : item
                    ),
                  }))
                }
                onRemove={() =>
                  setDraft((current) => ({
                    ...current,
                    rules: current.rules.filter((item) => item.id !== rule.id),
                  }))
                }
              />
            </div>
          ))}
          {!draft.rules.length ? (
            <div
              data-slot="targeting-rules-empty"
              className="flex flex-col items-center rounded-md border border-dashed px-5 py-10 text-center"
            >
              <p className="text-sm text-muted-foreground">
                {t("segments.detailsPage.rules.empty")}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-4"
                disabled={!canUpdateRules}
                onClick={addRule}
              >
                <Plus />
                {t("segments.detailsPage.rules.addRule")}
              </Button>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("segments.detailsPage.targeting.ruleHelp")}
        </p>
      </section>

      <ChangeReviewDialog
        open={reviewOpen}
        kind="targeting"
        segmentName={segment.name}
        changes={changes}
        requireComment={requireComment}
        saving={saveMutation.isPending}
        onOpenChange={setReviewOpen}
        onSave={(comment) => saveMutation.mutate(comment)}
      />
    </div>
  )
}
