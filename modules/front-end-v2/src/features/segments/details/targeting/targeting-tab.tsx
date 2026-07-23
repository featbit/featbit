import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  GripVertical,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { searchSegmentUsers, updateSegmentTargeting } from "../../segments-api"
import type {
  Segment,
  SegmentEndUser,
  SegmentRule,
  SegmentUserProperty,
} from "../../segments-types"
import { ChangeReviewDialog } from "../components/change-review-dialog"
import {
  cloneSegment,
  conditionValues,
  newId,
  normalizedRules,
  stableTargeting,
  targetingChanges,
  withConditionValues,
} from "../segment-details-utils"

const operators = [
  "Equal",
  "NotEqual",
  "LessThan",
  "LessEqualThan",
  "BiggerThan",
  "BiggerEqualThan",
  "IsOneOf",
  "NotOneOf",
  "Contains",
  "NotContain",
  "StartsWith",
  "EndsWith",
  "MatchRegex",
  "NotMatchRegex",
  "IsTrue",
  "IsFalse",
] as const

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

function userLabel(user: SegmentEndUser) {
  return user.name?.trim() || user.keyId
}

function UserPicker({
  envId,
  shared,
  selected,
  excluded,
  disabled,
  onAdd,
}: {
  envId: string
  shared: boolean
  selected: string[]
  excluded: string[]
  disabled: boolean
  onAdd: (user: SegmentEndUser) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const query = useQuery({
    queryKey: ["segment-user-search", envId, shared, debounced, excluded],
    queryFn: () =>
      searchSegmentUsers(envId, {
        searchText: debounced,
        excludedKeyIds: excluded,
        globalUserOnly: shared,
      }),
    enabled: open,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-9 w-full justify-start font-normal text-muted-foreground"
          />
        }
      >
        <Search className="size-4" />
        {t("segments.detailsPage.targeting.searchUsers")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            placeholder={t("segments.detailsPage.targeting.searchUsers")}
            onValueChange={setSearch}
          />
          <CommandList>
            {query.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("segments.detailsPage.loading")}
              </div>
            ) : query.isError ? (
              <div className="flex items-center justify-between px-3 py-4 text-sm text-destructive">
                {t("segments.detailsPage.targeting.userSearchFailed")}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void query.refetch()}
                >
                  {t("segments.retry")}
                </Button>
              </div>
            ) : null}
            <CommandEmpty>
              {t("segments.detailsPage.targeting.noUsers")}
            </CommandEmpty>
            <CommandGroup>
              {(query.data ?? [])
                .filter((user) => !selected.includes(user.keyId))
                .map((user) => (
                  <CommandItem
                    key={`${user.envId ?? "global"}-${user.keyId}`}
                    value={user.keyId}
                    onSelect={() => {
                      onAdd(user)
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {userLabel(user)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.keyId}
                      </p>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function UserPanel({
  title,
  envId,
  shared,
  keys,
  users,
  otherKeys,
  disabled,
  onChange,
  onResolved,
}: {
  title: string
  envId: string
  shared: boolean
  keys: string[]
  users: Map<string, SegmentEndUser>
  otherKeys: string[]
  disabled: boolean
  onChange: (keys: string[]) => void
  onResolved: (user: SegmentEndUser) => void
}) {
  const { t } = useTranslation()
  return (
    <section className="min-w-0 rounded-md border p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {keys.length ? (
          <span className="text-xs text-muted-foreground">· {keys.length}</span>
        ) : null}
      </div>
      <UserPicker
        envId={envId}
        shared={shared}
        selected={keys}
        excluded={[...keys, ...otherKeys]}
        disabled={disabled}
        onAdd={(user) => {
          onResolved(user)
          onChange([...keys, user.keyId])
        }}
      />
      <div className="mt-2 max-h-44 overflow-y-auto pr-1">
        {keys.length ? (
          keys.map((key) => {
            const user = users.get(key)
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 border-b px-2 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {user ? userLabel(user) : key}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.keyId ?? key}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={t("segments.detailsPage.targeting.removeUser", {
                    user: user ? userLabel(user) : key,
                  })}
                  onClick={() =>
                    onChange(keys.filter((value) => value !== key))
                  }
                >
                  <X />
                </Button>
              </div>
            )
          })
        ) : (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t("segments.detailsPage.targeting.emptyUsers")}
          </p>
        )}
      </div>
    </section>
  )
}

function RuleEditor({
  rule,
  properties,
  disabled,
  onChange,
  onRemove,
}: {
  rule: SegmentRule
  properties: SegmentUserProperty[]
  disabled: boolean
  onChange: (rule: SegmentRule) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const propertyOptions = useMemo(
    () => [
      { name: "keyId", id: "keyId" },
      { name: "name", id: "name" },
      ...properties,
    ],
    [properties]
  )

  return (
    <article className="rounded-md border">
      <div className="flex items-center gap-3 border-b px-3 py-2">
        <GripVertical
          className="size-4 shrink-0 cursor-grab text-muted-foreground"
          aria-hidden
        />
        <Input
          value={rule.name}
          disabled={disabled}
          className="h-8 max-w-sm"
          aria-label={t("segments.detailsPage.rules.ruleName")}
          onChange={(event) => onChange({ ...rule, name: event.target.value })}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="ml-auto"
                disabled={disabled}
              />
            }
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onRemove}
            >
              {t("segments.detailsPage.rules.removeRule")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="space-y-2 px-4 py-3">
        {rule.conditions.map((condition, index) => {
          const values = conditionValues(condition)
          const valueDisabled =
            condition.op === "IsTrue" || condition.op === "IsFalse"
          return (
            <div key={condition.id}>
              {index ? (
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("segments.detailsPage.rules.and")}
                </p>
              ) : null}
              <div className="grid grid-cols-[minmax(10rem,1fr)_minmax(10rem,.9fr)_minmax(14rem,2fr)_2rem] gap-3">
                <Select
                  value={condition.property}
                  disabled={disabled}
                  onValueChange={(property) => {
                    if (!property) return
                    onChange({
                      ...rule,
                      conditions: rule.conditions.map((item) =>
                        item.id === condition.id ? { ...item, property } : item
                      ),
                    })
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {propertyOptions.map((property) => (
                        <SelectItem key={property.id} value={property.name}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  value={condition.op}
                  disabled={disabled}
                  onValueChange={(op) => {
                    if (!op) return
                    onChange({
                      ...rule,
                      conditions: rule.conditions.map((item) =>
                        item.id === condition.id
                          ? withConditionValues({ ...item, op }, values)
                          : item
                      ),
                    })
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {operators.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {t(
                            `segments.detailsPage.rules.operators.${operator}`
                          )}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  value={valueDisabled ? "" : values.join(", ")}
                  disabled={disabled || valueDisabled}
                  placeholder={
                    condition.op === "IsOneOf" || condition.op === "NotOneOf"
                      ? t("segments.detailsPage.rules.multiValue")
                      : t("segments.detailsPage.rules.value")
                  }
                  onChange={(event) =>
                    onChange({
                      ...rule,
                      conditions: rule.conditions.map((item) =>
                        item.id === condition.id
                          ? withConditionValues(
                              item,
                              condition.op === "IsOneOf" ||
                                condition.op === "NotOneOf"
                                ? event.target.value
                                    .split(",")
                                    .map((value) => value.trim())
                                    .filter(Boolean)
                                : [event.target.value]
                            )
                          : item
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={t("segments.detailsPage.rules.removeCondition")}
                  onClick={() =>
                    onChange({
                      ...rule,
                      conditions: rule.conditions.filter(
                        (item) => item.id !== condition.id
                      ),
                    })
                  }
                >
                  <X />
                </Button>
              </div>
            </div>
          )
        })}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          disabled={disabled}
          onClick={() =>
            onChange({
              ...rule,
              conditions: [
                ...rule.conditions,
                { id: newId(), property: "keyId", op: "Equal", value: "" },
              ],
            })
          }
        >
          <Plus />
          {t("segments.detailsPage.rules.addCondition")}
        </Button>
      </div>
    </article>
  )
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
  const [dragIndex, setDragIndex] = useState<number | null>(null)

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

  return (
    <div className="space-y-7 pt-4 pb-5">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium">
            {t("segments.detailsPage.targeting.usersTitle")}
          </h2>
          <div className="flex items-center gap-5">
            {dirty ? (
              <span className="text-sm text-muted-foreground">
                {t("segments.detailsPage.unsavedChanges")}
              </span>
            ) : null}
            <Button
              type="button"
              disabled={!dirty || (!canUpdateRules && !canUpdateUsers)}
              onClick={() => setReviewOpen(true)}
            >
              {t("segments.detailsPage.reviewAndSave")}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <UserPanel
            title={t("segments.detailsPage.targeting.included")}
            envId={envId}
            shared={segment.type === "shared"}
            keys={draft.included}
            users={resolvedUsers}
            otherKeys={draft.excluded}
            disabled={!canUpdateUsers}
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
            onClick={() =>
              setDraft((current) => ({
                ...current,
                rules: [
                  ...current.rules,
                  {
                    id: newId(),
                    name: t("segments.detailsPage.rules.defaultName", {
                      count: current.rules.length + 1,
                    }),
                    conditions: [],
                  },
                ],
              }))
            }
          >
            {t("segments.detailsPage.rules.addRule")}
          </Button>
        </div>
        <div className="space-y-3">
          {draft.rules.map((rule, index) => (
            <div
              key={rule.id}
              draggable={canUpdateRules}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex === null || dragIndex === index) return
                setDraft((current) => {
                  const rules = [...current.rules]
                  const [moved] = rules.splice(dragIndex, 1)
                  rules.splice(index, 0, moved)
                  return { ...current, rules }
                })
                setDragIndex(null)
              }}
            >
              <RuleEditor
                rule={rule}
                properties={properties}
                disabled={!canUpdateRules}
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
            <div className="rounded-md border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
              {t("segments.detailsPage.rules.empty")}
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
