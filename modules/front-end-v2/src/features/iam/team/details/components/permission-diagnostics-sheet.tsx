import {
  CheckCircle2,
  ChevronsUpDown,
  ExternalLink,
  LoaderCircle,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { SelectableCommandList } from "@/components/selectable-command-list"
import { StablePopoverContent } from "@/components/stable-popover-content"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandInput } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  PERMISSION_ACTIONS,
  RESOURCE_PATTERNS,
  RESOURCE_TYPES,
  SPECIFIC_RESOURCE_TYPES,
  type PermissionAction,
  type PolicyResource,
  type ResourceType,
} from "@/features/iam/policies/details/permission-model"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type { TFunction } from "i18next"
import {
  evaluateMemberPermission,
  fetchPermissionResources,
  type MemberPermissionEvaluation,
} from "../permissions-api"
import {
  focusStatementIdForDecision,
  groupMemberPermissionsByPolicy,
  isWildcardResource,
  permissionActionFallback,
  type MemberPermissionPolicyGroup,
} from "../permissions-model"

export function PermissionDiagnosticsSheet({
  memberId,
  lang,
  open,
  onOpenChange,
}: {
  memberId: string
  lang: Lang
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const portalContainer = useRef<HTMLDivElement | null>(null)
  const [resourceType, setResourceType] = useState<ResourceType | "">("")
  const [resource, setResource] = useState<PolicyResource | null>(null)
  const [action, setAction] = useState("")
  const [checking, setChecking] = useState(false)
  const [evaluation, setEvaluation] =
    useState<MemberPermissionEvaluation | null>(null)
  const [error, setError] = useState(false)

  const supportsSpecific =
    resourceType !== "" && SPECIFIC_RESOURCE_TYPES.has(resourceType)
  const actions = useMemo(
    () =>
      resourceType
        ? PERMISSION_ACTIONS.filter(
            (item) => item.resourceType === resourceType && item.name !== "*"
          )
        : [],
    [resourceType]
  )
  const evaluatedResource = resourceType
    ? supportsSpecific
      ? (resource?.rn ?? "")
      : RESOURCE_PATTERNS[resourceType]
    : ""

  function reset() {
    setResourceType("")
    setResource(null)
    setAction("")
    setEvaluation(null)
    setError(false)
  }

  function changeResourceType(value: ResourceType) {
    setResourceType(value)
    setResource(null)
    setAction("")
    setEvaluation(null)
    setError(false)
  }

  function changeResource(value: PolicyResource) {
    setResource(value)
    setEvaluation(null)
    setError(false)
  }

  function changeAction(value: string) {
    setAction(value)
    setEvaluation(null)
    setError(false)
  }

  async function checkAccess() {
    if (!evaluatedResource || !action) return
    setChecking(true)
    setError(false)
    try {
      setEvaluation(
        await evaluateMemberPermission(memberId, {
          resource: evaluatedResource,
          action,
        })
      )
    } catch {
      setEvaluation(null)
      setError(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset()
        onOpenChange(nextOpen)
      }}
    >
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,30rem)] data-[side=right]:sm:max-w-[30rem]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle className="text-lg font-semibold">
            {t("iam.team.details.checkAccess")}
          </SheetTitle>
          <SheetDescription>
            {t("iam.team.details.checkAccessDescription")}
          </SheetDescription>
        </SheetHeader>

        <div
          ref={portalContainer}
          className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] space-y-6 overflow-y-auto px-6 py-5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        >
          <div className="space-y-5">
            <Field
              label={t("iam.team.details.resourceType")}
              htmlFor="permission-resource-type"
            >
              <Select
                value={resourceType || null}
                onValueChange={(value) => {
                  if (value) changeResourceType(value as ResourceType)
                }}
              >
                <SelectTrigger
                  id="permission-resource-type"
                  className="w-full bg-background"
                >
                  <SelectValue>
                    {resourceType
                      ? resourceTypeLabel(resourceType, t)
                      : t("iam.team.details.selectResourceType")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {RESOURCE_TYPES.filter((type) => type !== "*").map(
                      (type) => (
                        <SelectItem key={type} value={type}>
                          {resourceTypeLabel(type, t)}
                        </SelectItem>
                      )
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t("iam.team.details.resource")}
              htmlFor="permission-resource"
            >
              {resourceType ? (
                supportsSpecific ? (
                  <ResourceCombobox
                    key={resourceType}
                    type={resourceType}
                    value={resource}
                    triggerId="permission-resource"
                    portalContainer={portalContainer}
                    onChange={changeResource}
                  />
                ) : (
                  <WildcardResourceValue
                    id="permission-resource"
                    label={allResourcesLabel(resourceType, t)}
                    resource={RESOURCE_PATTERNS[resourceType]}
                    className="flex h-8 items-center rounded-lg border bg-muted/30 px-2.5 text-sm font-medium text-foreground"
                  />
                )
              ) : (
                <div
                  id="permission-resource"
                  className="flex h-8 items-center rounded-lg border bg-muted/30 px-2.5 text-sm text-muted-foreground"
                >
                  {t("iam.team.details.selectResourceTypeFirst")}
                </div>
              )}
            </Field>

            <Field
              label={t("iam.team.details.action")}
              htmlFor="permission-action"
            >
              <Select
                value={action || null}
                disabled={!resourceType}
                onValueChange={(value) => {
                  if (value) changeAction(value)
                }}
              >
                <SelectTrigger
                  id="permission-action"
                  className="w-full bg-background"
                >
                  <SelectValue>
                    {action
                      ? actionLabel(action, t)
                      : t("iam.team.details.selectAction")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {actions.map((item) => {
                      const label = actionOptionLabel(item, t)

                      return (
                        <SelectItem
                          key={item.name}
                          value={item.name}
                          label={label}
                          className="py-1.5"
                        >
                          <span className="flex min-w-0 flex-col items-start gap-0.5 overflow-hidden">
                            <span className="w-full truncate leading-5 font-medium">
                              {label}
                            </span>
                            <span className="w-full truncate font-mono text-xs leading-4 text-muted-foreground opacity-80">
                              {item.name}
                            </span>
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Button
              type="button"
              className="w-full"
              disabled={!evaluatedResource || !action || checking}
              onClick={checkAccess}
            >
              {checking ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              {checking
                ? t("iam.team.details.checkingAccess")
                : t("iam.team.details.checkAccess")}
            </Button>
          </div>

          {error ? (
            <Alert variant="destructive">
              <XCircle />
              <AlertTitle>{t("iam.team.details.evaluationFailed")}</AlertTitle>
              <AlertDescription>
                {t("iam.team.details.evaluationFailedDescription")}
              </AlertDescription>
            </Alert>
          ) : null}

          {evaluation ? (
            <>
              <Separator />
              <EvaluationResult
                evaluation={evaluation}
                resourceType={resourceType as ResourceType}
                lang={lang}
                t={t}
              />
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}

function ResourceCombobox({
  type,
  value,
  triggerId,
  portalContainer,
  onChange,
}: {
  type: ResourceType
  value: PolicyResource | null
  triggerId: string
  portalContainer: React.RefObject<HTMLDivElement | null>
  onChange: (resource: PolicyResource) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<PolicyResource[]>([])
  const [loading, setLoading] = useState(false)
  const requestVersion = useRef(0)
  const selectedResourceLabel = value
    ? resourceOptionLabel(value, type, t)
    : t("iam.team.details.selectResource")

  useEffect(() => {
    if (!open) return
    const version = ++requestVersion.current
    const timeout = window.setTimeout(
      () => {
        setLoading(true)
        fetchPermissionResources(query.trim(), type)
          .then((items) => {
            if (requestVersion.current === version) setOptions(items)
          })
          .catch(() => {
            if (requestVersion.current === version) setOptions([])
          })
          .finally(() => {
            if (requestVersion.current === version) setLoading(false)
          })
      },
      query.trim() ? 200 : 0
    )
    return () => window.clearTimeout(timeout)
  }, [open, query, type])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={triggerId}
            type="button"
            variant="outline"
            className="h-8 w-full justify-between bg-background px-2.5 font-normal"
            aria-expanded={open}
            aria-label={
              value
                ? `${selectedResourceLabel}: ${value.rn}`
                : selectedResourceLabel
            }
          >
            <span
              className={value ? "truncate" : "truncate text-muted-foreground"}
            >
              {selectedResourceLabel}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <StablePopoverContent
        portalContainer={portalContainer}
        align="start"
        className="w-[min(27rem,calc(100vw-3rem))] p-0"
      >
        <Command shouldFilter={false} className="rounded-md">
          <CommandInput
            value={query}
            placeholder={t("iam.team.details.searchResources")}
            onValueChange={setQuery}
          />
          <SelectableCommandList
            items={options}
            getKey={(item) => item.rn}
            getValue={(item) =>
              `${resourceOptionLabel(item, type, t)} ${item.rn}`
            }
            isSelected={(item) => item.rn === value?.rn}
            onSelect={(item) => {
              onChange(item)
              setOpen(false)
            }}
            emptyContent={t("iam.team.details.noResources")}
            loading={loading}
            loadingContent={
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            }
            listClassName="max-h-64 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto p-1 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
            renderItem={(item) => (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium [overflow-wrap:anywhere] break-words">
                  {resourceOptionLabel(item, type, t)}
                </p>
                <p className="font-mono text-xs break-all text-muted-foreground">
                  {item.rn}
                </p>
              </div>
            )}
          />
        </Command>
      </StablePopoverContent>
    </Popover>
  )
}

function EvaluationResult({
  evaluation,
  resourceType,
  lang,
  t,
}: {
  evaluation: MemberPermissionEvaluation
  resourceType: ResourceType
  lang: Lang
  t: TFunction
}) {
  const allowed = evaluation.granted
  const matchedPolicies = groupMemberPermissionsByPolicy(
    evaluation.matchedRules
  )
  const evaluatedActionLabel = actionLabel(evaluation.action, t)
  const reason =
    evaluation.decision === "allowed"
      ? t("iam.team.details.allowedDescription")
      : evaluation.decision === "explicitDeny"
        ? t("iam.team.details.explicitDenyDescription")
        : t("iam.team.details.noMatchingRuleDescription")

  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">
          {t("iam.team.details.evaluationResult")}
        </h3>
        <Alert
          className={
            allowed
              ? "mt-3 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "mt-3 border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          }
        >
          {allowed ? <CheckCircle2 /> : <XCircle />}
          <AlertTitle>
            {allowed
              ? t("iam.team.details.allowed")
              : t("iam.team.details.denied")}
          </AlertTitle>
          <AlertDescription className="text-current/80">
            {reason}
          </AlertDescription>
        </Alert>
      </div>

      <dl className="grid gap-4">
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">
            {t("iam.team.details.resource")}
          </dt>
          <dd className="mt-1 min-w-0">
            {isWildcardResource(evaluation.resource) ? (
              <WildcardResourceValue
                label={allResourcesLabel(resourceType, t)}
                resource={evaluation.resource}
                className="inline-flex max-w-full items-center text-sm font-medium text-foreground"
              />
            ) : (
              <span className="font-mono text-xs leading-5 break-all select-text">
                {evaluation.resource}
              </span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">
            {t("iam.team.details.action")}
          </dt>
          <dd className="mt-1 flex min-w-0 flex-col gap-0.5">
            <span className="text-sm leading-5 font-medium [overflow-wrap:anywhere] break-words">
              {evaluatedActionLabel}
            </span>
            {evaluatedActionLabel !== evaluation.action ? (
              <span className="font-mono text-xs leading-4 [overflow-wrap:anywhere] break-words text-muted-foreground">
                {evaluation.action}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">
            {t("iam.team.details.matchedPolicies")}
          </h3>
          <Badge
            variant="secondary"
            className="rounded-full font-normal tabular-nums"
          >
            {matchedPolicies.length}
          </Badge>
        </div>
        {matchedPolicies.length ? (
          <div className="mt-2 divide-y border-y">
            {matchedPolicies.map((policy) => (
              <MatchedPolicy
                key={policy.policyId}
                policy={policy}
                decision={evaluation.decision}
                lang={lang}
                t={t}
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {t("iam.team.details.noMatchedPolicies")}
          </p>
        )}
      </div>
    </section>
  )
}

function MatchedPolicy({
  policy,
  decision,
  lang,
  t,
}: {
  policy: MemberPermissionPolicyGroup
  decision: MemberPermissionEvaluation["decision"]
  lang: Lang
  t: TFunction
}) {
  const sourceLabels = policy.sources.map((source) =>
    source.assignmentType === "direct"
      ? t("iam.team.details.directPolicy")
      : t("iam.team.details.viaGroup", {
          name: source.groupName || t("iam.team.details.unknownGroup"),
        })
  )
  const statementSearch = new URLSearchParams()
  for (const statementId of policy.statementIds) {
    statementSearch.append("statementId", statementId)
  }
  const focusStatementId = focusStatementIdForDecision(policy, decision)
  if (focusStatementId) {
    statementSearch.set("focusStatementId", focusStatementId)
  }
  const policyUrl = `${localizedPath(
    lang,
    `/iam/policies/${encodeURIComponent(policy.policyId)}/permission`
  )}?${statementSearch.toString()}`
  const supportingText = [
    sourceLabels.join(" · "),
    t("iam.team.details.matchingStatements", {
      count: policy.statementIds.length,
    }),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="py-3 first:pt-2 last:pb-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                to={policyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-1 text-sm font-semibold hover:underline"
              />
            }
          >
            <span className="truncate">{policy.policyName}</span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-[min(28rem,calc(100vw-2rem))] [overflow-wrap:anywhere] break-words">
            {policy.policyName}
          </TooltipContent>
        </Tooltip>
        <div className="flex shrink-0 items-center gap-1.5">
          {policy.effects.map((effect) => (
            <Badge
              key={effect}
              variant="outline"
              className={
                effect === "allow"
                  ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                  : "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
              }
            >
              {effect === "allow"
                ? t("iam.team.details.allow")
                : t("iam.team.details.deny")}
            </Badge>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs leading-5 [overflow-wrap:anywhere] break-words text-muted-foreground">
        {supportingText}
      </p>
    </div>
  )
}

function resourceTypeLabel(resourceType: ResourceType, t: TFunction) {
  return t(
    `iam.policies.details.permissionsEditor.resourceTypes.${resourceType}`,
    { defaultValue: resourceType }
  )
}

function allResourcesLabel(resourceType: ResourceType, t: TFunction) {
  if (resourceType === "*") {
    return t("iam.policies.details.permissionsEditor.allResources")
  }

  const pluralType = t(
    `iam.policies.details.permissionsEditor.resourceTypePlurals.${resourceType}`,
    { defaultValue: resourceTypeLabel(resourceType, t).toLocaleLowerCase() }
  )

  return t("iam.team.details.allResourcesOfType", {
    type: pluralType,
  })
}

function resourceOptionLabel(
  resource: PolicyResource,
  resourceType: ResourceType,
  t: TFunction
) {
  return isWildcardResource(resource.rn)
    ? allResourcesLabel(resourceType, t)
    : resource.name
}

function WildcardResourceValue({
  id,
  label,
  resource,
  className,
}: {
  id?: string
  label: string
  resource: string
  className: string
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement | null>(null)

  return (
    <span id={id} className={className}>
      <Tooltip
        open={tooltipOpen}
        onOpenChange={(nextOpen, eventDetails) => {
          // Base UI's delay group can emit a transient `none` close while
          // this Sheet tooltip is mounting. Ignore it only while the trigger
          // still owns hover or keyboard focus.
          const triggerStillActive =
            triggerRef.current?.matches(":hover") ||
            document.activeElement === triggerRef.current
          if (
            !nextOpen &&
            eventDetails.reason === "none" &&
            triggerStillActive
          ) {
            return
          }
          setTooltipOpen(nextOpen)
        }}
      >
        <TooltipTrigger
          closeOnClick={false}
          render={
            <span
              ref={triggerRef}
              tabIndex={0}
              className="inline-flex min-w-0 max-w-full cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        >
          <span className="truncate">{label}</span>
          <span className="sr-only">: {resource}</span>
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className="pointer-events-none max-w-[min(28rem,calc(100vw-2rem))] font-mono [overflow-wrap:anywhere] break-words"
        >
          {resource}
        </TooltipContent>
      </Tooltip>
    </span>
  )
}

function actionLabel(action: string, t: TFunction) {
  return t(`iam.policies.details.permissionsEditor.actionLabels.${action}`, {
    defaultValue: permissionActionFallback(action),
  })
}

function actionOptionLabel(action: PermissionAction, t: TFunction) {
  return actionLabel(action.name, t)
}
