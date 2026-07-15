import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getCurrentWorkspace,
  localizedPath,
} from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import {
  getLicenseStatus,
  isFeatureGranted,
  parseLicense,
} from "@/features/workspace/license/license-utils"
import { cn } from "@/lib/utils"
import { ActionPicker } from "./action-picker"
import { ClonePolicySheet } from "./clone-policy-sheet"
import { ResourcePicker } from "./resource-picker"
import {
  updatePolicyStatements,
  type PolicyDetail,
} from "../policy-details-api"
import {
  PERMISSION_ACTIONS,
  RESOURCE_PATTERNS,
  RESOURCE_TYPES,
  createPolicyStatement,
  isAllResources,
  resourceDisplayName,
  type PolicyEffect,
  type PolicyStatement,
  type ResourceType,
} from "../permission-model"

export function PermissionsEditor({
  policy,
  loading,
  lang,
  onPolicyChange,
}: {
  policy: PolicyDetail | null
  loading: boolean
  lang: Lang
  onPolicyChange: (policy: PolicyDetail) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [statements, setStatements] = useState<PolicyStatement[]>(
    policy?.statements ?? []
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const original = JSON.stringify(policy?.statements ?? [])
  const current = JSON.stringify(statements)
  const dirty = original !== current
  const readOnly = policy?.type === "SysManaged"
  const valid = statements.every(
    (statement) =>
      statement.actions.length > 0 && statement.resources.length > 0
  )
  const license = useMemo(
    () => parseLicense(getCurrentWorkspace()?.license),
    []
  )
  const fineGrainedGranted = isFeatureGranted(
    {
      id: "fine-grained-ac",
      labelKey: "workspace.license.features.fineGrainedAccessControl.title",
      descriptionKey:
        "workspace.license.features.fineGrainedAccessControl.description",
    },
    license,
    getLicenseStatus(license)
  )

  function updateStatement(id: string, patch: Partial<PolicyStatement>) {
    setStatements((items) =>
      items.map((statement) =>
        statement.id === id ? { ...statement, ...patch } : statement
      )
    )
  }

  function changeResourceType(
    statement: PolicyStatement,
    resourceType: ResourceType
  ) {
    const hasAllAction = PERMISSION_ACTIONS.some(
      (action) => action.resourceType === resourceType && action.name === "*"
    )
    updateStatement(statement.id, {
      resourceType,
      resources: [RESOURCE_PATTERNS[resourceType]],
      actions: hasAllAction ? ["*"] : [],
    })
  }

  async function save() {
    if (!policy) return
    if (!valid) {
      setShowErrors(true)
      toast.error(t("iam.policies.details.permissionsEditor.validationError"))
      return
    }
    setSaving(true)
    try {
      await updatePolicyStatements(policy.id, statements)
      onPolicyChange({ ...policy, statements })
      toast.success(t("iam.policies.operationSucceeded"))
    } catch {
      toast.error(t("iam.policies.operationFailed"))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !policy) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  return (
    <section className="space-y-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg leading-snug font-semibold">
            {t("iam.policies.details.permissionsEditor.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("iam.policies.details.permissionsEditor.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const statement = createPolicyStatement()
                setStatements((items) => [...items, statement])
                setExpandedId(statement.id)
              }}
            >
              <Plus />
              {t("iam.policies.details.permissionsEditor.addPermission")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => setCloneOpen(true)}
          >
            <Copy />
            {t("iam.policies.details.permissionsEditor.clone")}
          </Button>
          {!readOnly ? (
            <Button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void save()}
            >
              <Save />
              {saving
                ? t("iam.policies.saving")
                : t("iam.policies.details.permissionsEditor.saveChanges")}
            </Button>
          ) : null}
        </div>
      </div>

      {!fineGrainedGranted ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100">
          <ShieldAlert />
          <AlertTitle>
            {t("iam.policies.details.permissionsEditor.enterpriseTitle")}
          </AlertTitle>
          <AlertDescription className="text-amber-900/80 dark:text-amber-100/80">
            {t("iam.policies.details.permissionsEditor.enterpriseDescription")}
          </AlertDescription>
        </Alert>
      ) : null}

      {readOnly ? (
        <Alert>
          <ShieldAlert />
          <AlertTitle>
            {t("iam.policies.details.permissionsEditor.systemManagedTitle")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "iam.policies.details.permissionsEditor.systemManagedDescription"
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12" />
              <TableHead className="w-32">
                {t("iam.policies.details.permissionsEditor.effect")}
              </TableHead>
              <TableHead>
                {t("iam.policies.details.permissionsEditor.resourceScope")}
              </TableHead>
              <TableHead>
                {t("iam.policies.details.permissionsEditor.actions")}
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {statements.length ? (
              statements.map((statement, index) => {
                const expanded = expandedId === statement.id
                const statementInvalid =
                  showErrors &&
                  (!statement.resources.length || !statement.actions.length)
                return (
                  <PermissionRows
                    key={statement.id}
                    index={index}
                    statement={statement}
                    expanded={expanded}
                    readOnly={readOnly}
                    invalid={statementInvalid}
                    fineGrainedGranted={fineGrainedGranted}
                    onToggle={() =>
                      setExpandedId(expanded ? null : statement.id)
                    }
                    onChange={(patch) => updateStatement(statement.id, patch)}
                    onResourceTypeChange={(type) =>
                      changeResourceType(statement, type)
                    }
                    onRemove={() =>
                      setStatements((items) =>
                        items.filter((item) => item.id !== statement.id)
                      )
                    }
                  />
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-36 text-center">
                  <p className="font-medium">
                    {t("iam.policies.details.permissionsEditor.emptyTitle")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(
                      "iam.policies.details.permissionsEditor.emptyDescription"
                    )}
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ClonePolicySheet
        open={cloneOpen}
        policy={policy}
        onOpenChange={setCloneOpen}
        onCloned={(cloned) => {
          setCloneOpen(false)
          navigate(localizedPath(lang, `/iam/policies/${cloned.id}/permission`))
        }}
      />
    </section>
  )
}

function PermissionRows({
  index,
  statement,
  expanded,
  readOnly,
  invalid,
  fineGrainedGranted,
  onToggle,
  onChange,
  onResourceTypeChange,
  onRemove,
}: {
  index: number
  statement: PolicyStatement
  expanded: boolean
  readOnly: boolean
  invalid: boolean
  fineGrainedGranted: boolean
  onToggle: () => void
  onChange: (patch: Partial<PolicyStatement>) => void
  onResourceTypeChange: (type: ResourceType) => void
  onRemove: () => void
}) {
  const { t, i18n } = useTranslation()
  const listFormatter = new Intl.ListFormat(
    i18n.resolvedLanguage === "zh" ? "zh-CN" : "en-US",
    { style: "short", type: "conjunction" }
  )
  const resourceLabel = t(
    `iam.policies.details.permissionsEditor.resourceTypes.${statement.resourceType}`,
    {
      defaultValue: statement.resourceType,
    }
  )
  const resourcePluralLabel = t(
    `iam.policies.details.permissionsEditor.resourceTypePlurals.${statement.resourceType}`,
    { defaultValue: statement.resourceType }
  )
  const actionLabels = statement.actions.slice(0, 3).map((name) => {
    const item = PERMISSION_ACTIONS.find(
      (candidate) =>
        candidate.resourceType === statement.resourceType &&
        candidate.name === name
    )
    return t(`iam.policies.details.permissionsEditor.actionLabels.${name}`, {
      defaultValue: item?.label ?? name,
    })
  })
  const resourceSummary = isAllResources(statement)
    ? statement.resourceType === "*"
      ? t("iam.policies.details.permissionsEditor.allResources")
      : t("iam.policies.details.permissionsEditor.allResourceType", {
          type: resourceLabel,
        })
    : t("iam.policies.details.permissionsEditor.resourcesSelectedByType", {
        count: statement.resources.length,
        type: resourcePluralLabel,
      })

  return (
    <>
      <TableRow
        aria-expanded={expanded}
        className={cn(expanded && "border-b-0 bg-muted/30")}
      >
        <TableCell>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onToggle}
            aria-label={t("iam.policies.details.permissionsEditor.toggleRule", {
              number: index + 1,
            })}
          >
            {expanded ? <ChevronDown /> : <ChevronRight />}
          </Button>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn(
              statement.effect === "allow"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            )}
          >
            {t(`iam.policies.details.permissionsEditor.${statement.effect}`)}
          </Badge>
        </TableCell>
        <TableCell className="max-w-80">
          <span className="block truncate font-medium">{resourceSummary}</span>
          {!isAllResources(statement) ? (
            <span className="block truncate text-xs text-muted-foreground">
              {summaryText(
                statement.resources.slice(0, 3).map(resourceDisplayName),
                statement.resources.length,
                listFormatter,
                (items, count) =>
                  t("iam.policies.details.permissionsEditor.summaryOverflow", {
                    items,
                    count,
                  })
              )}
            </span>
          ) : null}
        </TableCell>
        <TableCell className="max-w-80">
          <span className="block truncate">
            {actionLabels.length
              ? summaryText(
                  actionLabels,
                  statement.actions.length,
                  listFormatter,
                  (items, count) =>
                    t(
                      "iam.policies.details.permissionsEditor.summaryOverflow",
                      { items, count }
                    )
                )
              : t("iam.policies.details.permissionsEditor.noActionsSelected")}
          </span>
        </TableCell>
        <TableCell>
          {!readOnly ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label={t(
                "iam.policies.details.permissionsEditor.removeRule",
                { number: index + 1 }
              )}
            >
              <Trash2 />
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="p-0 whitespace-normal">
            <div className="grid gap-5 border-t px-5 py-5 lg:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label>
                  {t("iam.policies.details.permissionsEditor.effect")}
                </Label>
                <Select
                  value={statement.effect}
                  onValueChange={(value) =>
                    value && onChange({ effect: value as PolicyEffect })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">
                      {t("iam.policies.details.permissionsEditor.allow")}
                    </SelectItem>
                    <SelectItem value="deny">
                      {t("iam.policies.details.permissionsEditor.deny")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {t("iam.policies.details.permissionsEditor.resourceScope")}
                </Label>
                <Select
                  value={statement.resourceType}
                  onValueChange={(value) =>
                    value && onResourceTypeChange(value as ResourceType)
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(
                          `iam.policies.details.permissionsEditor.resourceTypes.${type}`,
                          { defaultValue: type }
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ResourcePicker
                  resourceType={statement.resourceType}
                  resources={statement.resources}
                  disabled={readOnly}
                  invalid={invalid && !statement.resources.length}
                  onChange={(resources) =>
                    onChange({
                      resources,
                      actions: statement.actions.filter((name) => {
                        const action = PERMISSION_ACTIONS.find(
                          (item) =>
                            item.resourceType === statement.resourceType &&
                            item.name === name
                        )
                        return (
                          resources.includes(
                            RESOURCE_PATTERNS[statement.resourceType]
                          ) || action?.specificApplicable
                        )
                      }),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {t("iam.policies.details.permissionsEditor.actions")}
                </Label>
                <ActionPicker
                  statement={statement}
                  fineGrainedGranted={fineGrainedGranted}
                  disabled={readOnly}
                  invalid={invalid && !statement.actions.length}
                  onChange={(actions) => onChange({ actions })}
                />
              </div>
              {invalid ? (
                <div className="flex items-center gap-2 text-sm text-destructive lg:col-span-3">
                  <AlertTriangle className="size-4" />
                  {t("iam.policies.details.permissionsEditor.ruleRequired")}
                </div>
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

function summaryText(
  items: string[],
  total: number,
  formatter: Intl.ListFormat,
  overflow: (items: string, count: number) => string
) {
  const formatted = formatter.format(items)
  const remaining = total - items.length
  return remaining > 0 ? overflow(formatted, remaining) : formatted
}
