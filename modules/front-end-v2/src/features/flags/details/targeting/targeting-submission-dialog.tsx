import { Check, Loader2, Search, X } from "lucide-react"
import { useEffect, useState } from "react"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import { ChangeLedger } from "@/features/change-review/change-ledger"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import type { Lang } from "@/features/layout/layout-types"
import { fetchSegmentTeamMembers } from "@/features/segments/segments-api"
import type { SegmentTeamMember } from "@/features/segments/segments-types"

export type TargetingSubmission = {
  title: string
  scheduledTime: string
  reason: string
  reviewers: string[]
  withChangeRequest: boolean
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
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="w-full justify-start font-normal text-muted-foreground"
            />
          }
        >
          <Search />
          Search reviewers
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              placeholder="Search by name or email"
              onValueChange={setSearch}
            />
            <CommandList>
              {query.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : null}
              <CommandEmpty>No reviewers found.</CommandEmpty>
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
        </PopoverContent>
      </Popover>
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((member) => (
            <Badge key={member.id} variant="secondary" className="gap-1">
              {member.name}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${member.name}`}
                onClick={() =>
                  onChange(selected.filter((item) => item.id !== member.id))
                }
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function TargetingSubmissionDialog({
  mode,
  lang,
  flagName,
  changes,
  saving,
  onOpenChange,
  onSubmit,
}: {
  mode: "schedule" | "change-request" | null
  lang: Lang
  flagName: string
  changes: ChangeReviewItem[]
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (value: TargetingSubmission) => void
}) {
  const zh = lang === "zh"
  const schedule = mode === "schedule"
  const [title, setTitle] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [reason, setReason] = useState("")
  const [withApproval, setWithApproval] = useState(false)
  const [reviewers, setReviewers] = useState<SegmentTeamMember[]>([])
  const [openedAt] = useState(() => Date.now())
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
              ? zh
                ? "计划定向变更"
                : "Schedule targeting changes"
              : zh
                ? "请求审核定向变更"
                : "Request approval for targeting changes"}
          </DialogTitle>
          <DialogDescription>
            {zh
              ? `提交 ${flagName} 的待处理变更。`
              : `Submit the pending targeting changes to ${flagName}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <Label>{zh ? "变更" : "Changes"}</Label>
              <span className="text-sm text-muted-foreground">
                {changes.length} {zh ? "项变更" : "changes"}
              </span>
            </div>
            <ChangeLedger
              changes={changes}
              layout="targeting"
              copy={{
                label: (change) => change.label,
                action: (action) =>
                  ({ added: "Added", removed: "Removed", updated: "Updated" })[
                    action
                  ],
                actionCount: (action, count) =>
                  `${action === "added" ? "Added" : "Removed"} · ${count}`,
                showMore: (count) => `Show ${count} more`,
                showLess: "Show less",
              }}
            />
          </div>
          {schedule ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="schedule-title">
                  {zh ? "标题" : "Title"}
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
                  {zh ? "计划时间" : "Scheduled time"}
                  <span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="schedule-time"
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                />
                {scheduledTime && !future ? (
                  <p className="text-xs text-destructive">
                    Scheduled time must be in the future.
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
              {zh ? "原因" : "Reason"}
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
                  {zh ? "需要审核" : "Require approval"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {zh
                    ? "在计划时间应用前由审核人批准。"
                    : "Ask reviewers to approve before the scheduled change is applied."}
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
                {zh ? "审核人" : "Reviewers"}
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
            {zh ? "取消" : "Cancel"}
          </Button>
          <Button
            type="button"
            disabled={!valid || saving}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                scheduledTime,
                reason: reason.trim(),
                reviewers: reviewers.map((item) => item.id),
                withChangeRequest: reviewerRequired,
              })
            }
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {schedule
              ? zh
                ? "计划变更"
                : "Schedule changes"
              : zh
                ? "提交请求"
                : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
