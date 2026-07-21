import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import {
  Building2,
  Box,
  Flag,
  Folder,
  Info,
  Layers3,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react"
import type { RefObject } from "react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  PERMISSION_CATEGORIES,
  canGrantAction,
  supportsFineGrainedActions,
  visibleActions,
} from "../access-token-permissions"
import type {
  PermissionDraft,
  ResourceType,
  UserPolicy,
} from "../access-token-types"
import { ResourceSelection } from "./resource-selection"

const CATEGORY_ICONS = {
  flag: Flag,
  segment: Layers3,
  project: Folder,
  env: Box,
  iam: ShieldCheck,
  workspace: Building2,
} satisfies Record<ResourceType, typeof Flag>

export function PermissionsEditor({
  portalContainer,
  draft,
  policies,
  fineGrainedGranted,
  readOnly,
  validationAttempted,
  onChange,
}: {
  portalContainer: RefObject<HTMLDivElement | null>
  draft: PermissionDraft
  policies: UserPolicy[]
  fineGrainedGranted: boolean
  readOnly: boolean
  validationAttempted: boolean
  onChange: (draft: PermissionDraft) => void
}) {
  const { t } = useTranslation()
  const selectedCount = Object.values(draft).reduce(
    (total, category) => total + category.selectedActions.length,
    0
  )
  const missingPermission = validationAttempted && selectedCount === 0

  const hasPreservedFineGrainedActions =
    !fineGrainedGranted &&
    PERMISSION_CATEGORIES.some((category) =>
      category.actions.some(
        (permissionAction) =>
          permissionAction.fineGrained &&
          draft[category.type].selectedActions.includes(permissionAction.name)
      )
    )

  function updateCategory(
    type: ResourceType,
    next: PermissionDraft[ResourceType]
  ) {
    onChange({ ...draft, [type]: next })
  }

  return (
    <section className="space-y-4">
      <div
        className="space-y-1"
        tabIndex={missingPermission ? -1 : undefined}
        data-permission-error={missingPermission || undefined}
      >
        <h3 className="text-sm font-semibold text-foreground">
          {t("accessTokens.permissions.title")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("accessTokens.permissions.subtitle")}
        </p>
        {missingPermission ? (
          <p className="pt-1 text-xs text-destructive">
            {t("accessTokens.permissions.selectAtLeastOne")}
          </p>
        ) : null}
      </div>

      {hasPreservedFineGrainedActions ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100">
          <LockKeyhole />
          <AlertTitle>
            {t("accessTokens.permissions.preservedFineGrainedTitle")}
          </AlertTitle>
          <AlertDescription className="text-amber-900/80 dark:text-amber-100/80">
            {t(
              readOnly
                ? "accessTokens.permissions.preservedFineGrainedReadOnlyDescription"
                : "accessTokens.permissions.preservedFineGrainedDescription"
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="border-y">
        {PERMISSION_CATEGORIES.map((category) => {
          const categoryDraft = draft[category.type]
          const coarseActionsOnly =
            !fineGrainedGranted && supportsFineGrainedActions(category)
          const selectableActions = visibleActions(category, fineGrainedGranted)
          const preservedFineGrainedActions = coarseActionsOnly
            ? category.actions.filter(
                (permissionAction) =>
                  permissionAction.fineGrained &&
                  categoryDraft.selectedActions.includes(permissionAction.name)
              )
            : []
          const displayedActions = coarseActionsOnly
            ? [...selectableActions, ...preservedFineGrainedActions]
            : selectableActions
          const editableActions = selectableActions.filter(
            (permissionAction) =>
              !readOnly &&
              canGrantAction(policies, category.type, permissionAction.name) &&
              (!permissionAction.fineGrained || fineGrainedGranted)
          )
          const editableNames = editableActions.map((item) => item.name)
          const editableSelectedCount = editableNames.filter((name) =>
            categoryDraft.selectedActions.includes(name)
          ).length
          const allEditableSelected =
            editableNames.length > 0 &&
            (coarseActionsOnly
              ? categoryDraft.selectedActions.includes("*")
              : editableSelectedCount === editableNames.length)
          const partiallySelected = coarseActionsOnly
            ? categoryDraft.selectedActions.length > 0 && !allEditableSelected
            : editableSelectedCount > 0 && !allEditableSelected
          const scopeInvalid =
            validationAttempted &&
            categoryDraft.selectedActions.length > 0 &&
            category.supportsSpecific &&
            categoryDraft.scope === "specific" &&
            categoryDraft.specificResources.length === 0
          const categoryLabel = t(category.labelKey)
          const CategoryIcon = CATEGORY_ICONS[category.type]
          const scopeResource = category.supportsSpecific
            ? t(`accessTokens.permissions.scopeNouns.${category.type}`)
            : ""
          const selectedActionCount = categoryDraft.selectedActions.length

          function setAllActions(checked: boolean) {
            if (coarseActionsOnly) {
              updateCategory(category.type, {
                ...categoryDraft,
                selectedActions: checked ? ["*"] : [],
              })
              return
            }

            const preserved = categoryDraft.selectedActions.filter(
              (name) => !editableNames.includes(name)
            )
            updateCategory(category.type, {
              ...categoryDraft,
              selectedActions: checked
                ? [
                    ...preserved,
                    ...selectableActions
                      .map((item) => item.name)
                      .filter((name) => editableNames.includes(name)),
                  ]
                : preserved,
            })
          }

          function toggleAction(name: string, checked: boolean) {
            updateCategory(category.type, {
              ...categoryDraft,
              selectedActions: checked
                ? selectableActions
                    .map((item) => item.name)
                    .filter(
                      (actionName) =>
                        actionName === name ||
                        categoryDraft.selectedActions.includes(actionName)
                    )
                : categoryDraft.selectedActions.filter(
                    (actionName) => actionName !== name
                  ),
            })
          }

          return (
            <section
              key={category.type}
              className="space-y-3 border-b py-4 last:border-b-0"
              tabIndex={scopeInvalid ? -1 : undefined}
              data-permission-error={scopeInvalid || undefined}
            >
              <div className="flex min-h-9 items-center justify-between gap-4 rounded-md bg-muted/40 px-3 py-1.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CategoryIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 items-baseline gap-2">
                    <h4 className="truncate text-sm font-semibold text-foreground">
                      {categoryLabel}
                    </h4>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("accessTokens.permissions.selected", {
                        count: selectedActionCount,
                      })}
                    </span>
                  </div>
                </div>
                {!readOnly ? (
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                    <Checkbox
                      checked={allEditableSelected}
                      indeterminate={partiallySelected}
                      disabled={editableNames.length === 0}
                      onCheckedChange={setAllActions}
                    />
                    {t("accessTokens.permissions.selectAll")}
                  </label>
                ) : null}
              </div>

              <div className="space-y-3 px-3 sm:pl-10">
                {category.supportsSpecific ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-5 text-xs">
                      <span className="font-medium text-foreground">
                        {t("accessTokens.permissions.appliesTo")}
                      </span>
                      <RadioGroup
                        aria-label={t("accessTokens.permissions.scopeLabel", {
                          category: categoryLabel,
                        })}
                        value={categoryDraft.scope}
                        disabled={readOnly}
                        className="flex items-center gap-5"
                        onValueChange={(scope) =>
                          updateCategory(category.type, {
                            ...categoryDraft,
                            scope,
                          })
                        }
                      >
                        {(["all", "specific"] as const).map((scope) => (
                          <label
                            key={scope}
                            className={cn(
                              "flex items-center gap-2 text-foreground",
                              readOnly ? "cursor-default" : "cursor-pointer"
                            )}
                          >
                            <Radio.Root
                              value={scope}
                              className="flex size-4 items-center justify-center rounded-full border border-input outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary"
                            >
                              <Radio.Indicator className="size-2 rounded-full bg-primary" />
                            </Radio.Root>
                            {t(
                              `accessTokens.permissions.scopeOptions.${scope}`,
                              {
                                resource: scopeResource,
                              }
                            )}
                          </label>
                        ))}
                      </RadioGroup>
                    </div>

                    {categoryDraft.scope === "specific" ? (
                      <ResourceSelection
                        portalContainer={portalContainer}
                        resourceType={category.type}
                        resources={categoryDraft.specificResources}
                        readOnly={readOnly}
                        invalid={scopeInvalid}
                        onChange={(specificResources) => {
                          const appliesToAllResources =
                            specificResources.includes(category.pattern)
                          updateCategory(category.type, {
                            ...categoryDraft,
                            scope: appliesToAllResources
                              ? "all"
                              : categoryDraft.scope,
                            specificResources: appliesToAllResources
                              ? []
                              : specificResources,
                          })
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
                {displayedActions.length ? (
                  <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                    {displayedActions.map((permissionAction) => {
                      const authorized = canGrantAction(
                        policies,
                        category.type,
                        permissionAction.name
                      )
                      const licensed =
                        !permissionAction.fineGrained || fineGrainedGranted
                      const disabled = readOnly || !authorized || !licensed
                      const checked = categoryDraft.selectedActions.includes(
                        permissionAction.name
                      )

                      return (
                        <div
                          key={permissionAction.name}
                          className="flex min-w-0 items-center gap-2"
                        >
                          <Checkbox
                            id={`access-token-${category.type}-${permissionAction.name}`}
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(nextChecked) =>
                              toggleAction(permissionAction.name, nextChecked)
                            }
                          />
                          <label
                            htmlFor={`access-token-${category.type}-${permissionAction.name}`}
                            className={cn(
                              "min-w-0 truncate text-xs text-foreground",
                              disabled && !readOnly && "text-muted-foreground"
                            )}
                          >
                            {permissionAction.name}
                          </label>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  className="shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                  aria-label={t(
                                    permissionAction.descriptionKey
                                  )}
                                />
                              }
                            >
                              <Info className="size-3.5" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64">
                              {t(permissionAction.descriptionKey)}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
