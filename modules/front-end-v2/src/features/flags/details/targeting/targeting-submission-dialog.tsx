import { Check, Clock3, Loader2, UserRoundCheck, X } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import { ChangeLedger } from "@/features/change-review/change-ledger"
import { ReviewSaveSplitButton } from "@/features/change-review/change-review-dialog"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import { fetchSegmentTeamMembers } from "@/features/segments/segments-api"
import type { SegmentTeamMember } from "@/features/segments/segments-types"

export type TargetingSubmission = {
  title: string
  scheduledTime: string
  reason: string
  reviewers: string[]
  withChangeRequest: boolean
}

function localDateTimeInputValue(timestamp: number) {
  const date = new Date(timestamp)
  const local = new Date(timestamp - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function ReviewerPopoverContent({ children }: { children: ReactNode }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align="start"
        side="bottom"
        sideOffset={4}
        className="z-[60]"
        data-slot="reviewer-popover-positioner"
      >
        <PopoverPrimitive.Popup className="w-[var(--anchor-width)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function ReviewerPicker({
  selected,
  disabled,
  onChange,
}: {
  selected: SegmentTeamMember[]
  disabled: boolean
  onChange: (members: SegmentTeamMember[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(search.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [search])
  const currentUserId = getStoredUserProfile().id
  const query = useQuery({
    queryKey: ["flag-reviewers", debounced],
    queryFn: () =>
      fetchSegmentTeamMembers({ searchText: debounced, pageSize: 20 }),
    enabled: open,
  })
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <div
              role="combobox"
              aria-label={t(
                "featureFlags.detailsPage.submission.searchReviewers"
              )}
              aria-expanded={open}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : 0}
              className="flex max-h-24 min-h-8 w-full flex-wrap items-center gap-1.5 overflow-y-auto rounded-lg border border-input bg-transparent px-2 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:bg-input/30"
            />
          }
        >
          {selected.map((member) => (
            <Badge
              key={member.id}
              variant="secondary"
              className="h-6 gap-1 font-normal"
            >
              <Tooltip>
                <TooltipTrigger
                  render={<span tabIndex={0} className="cursor-default" />}
                >
                  {member.name}
                </TooltipTrigger>
                <TooltipContent>{member.email}</TooltipContent>
              </Tooltip>
              <button
                type="button"
                disabled={disabled}
                aria-label={t(
                  "featureFlags.detailsPage.submission.removeReviewer",
                  { name: member.name }
                )}
                className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onChange(selected.filter((item) => item.id !== member.id))
                }}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <span className="min-w-28 flex-1 text-left text-muted-foreground">
            {t("featureFlags.detailsPage.submission.searchReviewers")}
          </span>
        </PopoverTrigger>
        <ReviewerPopoverContent>
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              placeholder={t(
                "featureFlags.detailsPage.submission.searchReviewersPlaceholder"
              )}
              onValueChange={setSearch}
            />
            <CommandList>
              {query.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("featureFlags.detailsPage.submission.loadingReviewers")}
                </div>
              ) : null}
              <CommandEmpty>
                {t("featureFlags.detailsPage.submission.noReviewers")}
              </CommandEmpty>
              <CommandGroup>
                {(query.data?.items ?? [])
                  .filter((member) => member.id !== currentUserId)
                  .map((member) => {
                    const chosen = selected.some(
                      (item) => item.id === member.id
                    )
                    return (
                      <CommandItem
                        key={member.id}
                        value={member.id}
                        onSelect={() => {
                          onChange(
                            chosen
                              ? selected.filter((item) => item.id !== member.id)
                              : [...selected, member]
                          )
                        }}
                      >
                        <Check
                          className={chosen ? "opacity-100" : "opacity-0"}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {member.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            </CommandList>
          </Command>
        </ReviewerPopoverContent>
      </Popover>
    </div>
  )
}

export function TargetingSubmissionDialog({
  mode,
  flagName,
  changes,
  initialReason,
  scheduleGranted,
  changeRequestGranted,
  saving,
  onOpenChange,
  onModeChange,
  onSubmit,
}: {
  mode: "schedule" | "change-request" | null
  flagName: string
  changes: ChangeReviewItem[]
  initialReason?: string
  scheduleGranted: boolean
  changeRequestGranted: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onModeChange: (
    mode: "save" | "schedule" | "change-request",
    reason: string
  ) => void
  onSubmit: (value: TargetingSubmission) => void
}) {
  const { t } = useTranslation()
  const schedule = mode === "schedule"
  const [title, setTitle] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [reason, setReason] = useState(initialReason ?? "")
  const [withApproval, setWithApproval] = useState(false)
  const [reviewers, setReviewers] = useState<SegmentTeamMember[]>([])
  const [openedAt] = useState(() => Date.now())
  const minimumScheduledTime = localDateTimeInputValue(openedAt)
  const reviewerRequired = !schedule || withApproval
  const future =
    !schedule || (scheduledTime && new Date(scheduledTime).getTime() > openedAt)
  const valid = Boolean(
    reason.trim() &&
    (!schedule || (title.trim() && future)) &&
    (!reviewerRequired || reviewers.length)
  )
  return (
    <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {schedule
              ? t("featureFlags.detailsPage.submission.scheduleTitle")
              : t("featureFlags.detailsPage.submission.requestTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("featureFlags.detailsPage.submission.description", {
              name: flagName,
            })}
          </DialogDescription>
        </DialogHeader>
        <div
          data-slot="submission-dialog-body"
          className="max-h-[68vh] space-y-4 overflow-y-auto px-1"
        >
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <Label>{t("featureFlags.detailsPage.submission.changes")}</Label>
              <span className="text-sm text-muted-foreground">
                {t("featureFlags.detailsPage.submission.changeCount", {
                  count: changes.length,
                })}
              </span>
            </div>
            <ChangeLedger
              changes={changes}
              layout="targeting"
              copy={{
                label: (change) => change.label,
                action: (action) =>
                  t(`featureFlags.detailsPage.review.${action}`),
                actionCount: (action, count) =>
                  t("featureFlags.detailsPage.review.actionCount", {
                    action: t(`featureFlags.detailsPage.review.${action}`),
                    count,
                  }),
                showMore: (count) =>
                  t("featureFlags.detailsPage.review.showMore", { count }),
                showLess: t("featureFlags.detailsPage.review.showLess"),
              }}
            />
          </div>
          {schedule ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="schedule-title">
                  {t("featureFlags.detailsPage.submission.title")}
                  <span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="schedule-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-time">
                  {t("featureFlags.detailsPage.submission.scheduledTime")}
                  <span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="schedule-time"
                  type="datetime-local"
                  min={minimumScheduledTime}
                  value={scheduledTime}
                  onClick={(event) => event.currentTarget.showPicker?.()}
                  onChange={(event) => setScheduledTime(event.target.value)}
                />
                {scheduledTime && !future ? (
                  <p className="text-xs text-destructive">
                    {t("featureFlags.detailsPage.submission.futureTime")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                )}
              </div>
            </>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="submission-reason">
              {t("featureFlags.detailsPage.submission.reason")}
              <span className="text-destructive"> *</span>
            </Label>
            <Textarea
              id="submission-reason"
              value={reason}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {schedule ? (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="require-approval">
                  {t("featureFlags.detailsPage.submission.requireApproval")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("featureFlags.detailsPage.submission.approvalHelp")}
                </p>
              </div>
              <Switch
                id="require-approval"
                checked={withApproval}
                onCheckedChange={setWithApproval}
              />
            </div>
          ) : null}
          {reviewerRequired ? (
            <div className="space-y-2">
              <Label>
                {t("featureFlags.detailsPage.submission.reviewers")}
                <span className="text-destructive"> *</span>
              </Label>
              <ReviewerPicker
                selected={reviewers}
                disabled={saving}
                onChange={setReviewers}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t-0 bg-transparent">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("featureFlags.detailsPage.submission.cancel")}
          </Button>
          <ReviewSaveSplitButton
            primaryLabel={
              schedule
                ? t("featureFlags.detailsPage.submission.schedule")
                : t("featureFlags.detailsPage.submission.submitRequest")
            }
            savingLabel={t("featureFlags.detailsPage.submission.submitting")}
            saving={saving}
            primaryDisabled={!valid}
            menuLabel={t("featureFlags.detailsPage.submission.moreSaveOptions")}
            options={[
              {
                label: t("featureFlags.detailsPage.submission.save"),
                description: t(
                  "featureFlags.detailsPage.submission.applyImmediately"
                ),
                onSelect: () => onModeChange("save", reason.trim()),
              },
              ...(scheduleGranted
                ? [
                    {
                      label: t("featureFlags.detailsPage.submission.schedule"),
                      icon: <Clock3 />,
                      current: schedule,
                      onSelect: () => onModeChange("schedule", reason.trim()),
                    },
                  ]
                : []),
              ...(changeRequestGranted
                ? [
                    {
                      label: t(
                        "featureFlags.detailsPage.submission.requestApproval"
                      ),
                      icon: <UserRoundCheck />,
                      current: !schedule,
                      onSelect: () =>
                        onModeChange("change-request", reason.trim()),
                    },
                  ]
                : []),
            ]}
            onPrimary={() =>
              onSubmit({
                title: title.trim(),
                scheduledTime,
                reason: reason.trim(),
                reviewers: reviewers.map((item) => item.id),
                withChangeRequest: reviewerRequired,
              })
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
