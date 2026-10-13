import type { ReactNode } from "react"
import { Braces, Info, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FlagJsonEditorDialog } from "./flag-json-editor-dialog"
import {
  createDefaultFlagVariationSettings,
  flagVariationTypes,
  getFlagVariationValueError,
  type FlagVariationSettingsDraft,
  isFlagVariationSettingsCustomized,
  type FlagVariationType,
} from "./flag-variation-draft"

export function FlagVariationsEditor({
  value,
  disabled,
  onChange,
  onNestedSurfaceOpenChange,
  behaviorSettings,
}: {
  behaviorSettings: ReactNode
  value: FlagVariationSettingsDraft
  disabled: boolean
  onChange: (value: FlagVariationSettingsDraft) => void
  onNestedSurfaceOpenChange?: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const [pendingVariationType, setPendingVariationType] =
    useState<FlagVariationType | null>(null)
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(
    null
  )
  const [jsonEditorIndex, setJsonEditorIndex] = useState<number | null>(null)
  const [editedFields, setEditedFields] = useState<
    Record<string, Partial<Record<"name" | "value", boolean>>>
  >({})
  const untitledVariation = t("featureFlags.variationsEditor.untitled")
  const enabledVariation = value.variations.find(
    (variation) => variation.id === value.enabledVariationId
  )
  const disabledVariation = value.variations.find(
    (variation) => variation.id === value.disabledVariationId
  )
  const jsonEditorVariation =
    jsonEditorIndex === null ? null : value.variations[jsonEditorIndex]
  const pendingDeleteVariation =
    pendingDeleteIndex === null ? null : value.variations[pendingDeleteIndex]
  const pendingDeleteReplacement = value.variations.find(
    (_, index) => index !== pendingDeleteIndex
  )
  const pendingDeleteRoles = pendingDeleteVariation
    ? [
        value.enabledVariationId === pendingDeleteVariation.id
          ? t("featureFlags.variationsEditor.serveWhenOn")
          : null,
        value.disabledVariationId === pendingDeleteVariation.id
          ? t("featureFlags.variationsEditor.serveWhenOff")
          : null,
      ].filter((role): role is string => role !== null)
    : []

  function setTypeConfirmation(variationType: FlagVariationType | null) {
    setPendingVariationType(variationType)
    onNestedSurfaceOpenChange?.(Boolean(variationType))
  }

  function setJsonEditor(index: number | null) {
    setJsonEditorIndex(index)
    onNestedSurfaceOpenChange?.(index !== null)
  }

  function setDeleteConfirmation(index: number | null) {
    setPendingDeleteIndex(index)
    onNestedSurfaceOpenChange?.(index !== null)
  }

  function applyVariationType(variationType: FlagVariationType) {
    const nextValue = createDefaultFlagVariationSettings(variationType)
    setEditedFields({})
    onChange({ ...nextValue, isEnabled: value.isEnabled })
    setTypeConfirmation(null)
  }

  function updateVariation(
    index: number,
    field: "name" | "value",
    fieldValue: string
  ) {
    const id = value.variations[index].id
    setEditedFields((fields) => ({
      ...fields,
      [id]: { ...fields[id], [field]: true },
    }))
    onChange({
      ...value,
      variations: value.variations.map((variation, variationIndex) =>
        variationIndex === index
          ? { ...variation, [field]: fieldValue }
          : variation
      ),
    })
  }

  function addVariation() {
    const id = crypto.randomUUID()
    setEditedFields((fields) => ({
      ...fields,
      [id]: { name: true, value: true },
    }))
    onChange({
      ...value,
      variations: [
        ...value.variations,
        {
          id,
          name: "",
          value: value.variationType === "json" ? "{}" : "",
        },
      ],
    })
  }

  function requestRemoveVariation(index: number) {
    const variation = value.variations[index]
    const isUsedByDefaultRule =
      variation.id === value.enabledVariationId ||
      variation.id === value.disabledVariationId

    if (isUsedByDefaultRule) {
      setDeleteConfirmation(index)
    } else {
      removeVariation(index)
    }
  }

  function removeVariation(index: number) {
    const removed = value.variations[index]
    const variations = value.variations.filter(
      (_, variationIndex) => variationIndex !== index
    )
    const fallbackId = variations[0]?.id ?? ""
    onChange({
      ...value,
      variations,
      enabledVariationId:
        value.enabledVariationId === removed.id
          ? fallbackId
          : value.enabledVariationId,
      disabledVariationId:
        value.disabledVariationId === removed.id
          ? fallbackId
          : value.disabledVariationId,
    })
  }

  function valueErrorMessage(
    error: ReturnType<typeof getFlagVariationValueError>
  ) {
    if (error === "required")
      return t("featureFlags.variationsEditor.valueRequired")
    if (error === "boolean")
      return t("featureFlags.variationsEditor.booleanInvalid")
    if (error === "number")
      return t("featureFlags.variationsEditor.numberInvalid")
    if (error === "json") {
      return t("featureFlags.variationsEditor.jsonInvalid")
    }
    return ""
  }

  return (
    <>
      <div className="space-y-5">
        <section className="space-y-4">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-foreground">
              {t("featureFlags.variationsEditor.title")}
            </h3>
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("featureFlags.variationsEditor.typeHelp")}
              >
                <Info className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                {t("featureFlags.variationsEditor.typeHelp")}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-2">
            <Select
              value={value.variationType}
              disabled={disabled}
              onValueChange={(variationType) => {
                const nextType = variationType as FlagVariationType
                if (nextType === value.variationType) return
                if (isFlagVariationSettingsCustomized(value)) {
                  setTypeConfirmation(nextType)
                } else {
                  applyVariationType(nextType)
                }
              }}
            >
              <SelectTrigger className="w-44 shrink-0">
                <SelectValue>{value.variationType.toUpperCase()}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {flagVariationTypes.map((variationType) => (
                    <SelectItem key={variationType} value={variationType}>
                      {variationType.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="overflow-hidden">
              <div
                className={
                  value.variationType === "boolean"
                    ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
                    : "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
                }
              >
                <span>{t("featureFlags.variationsEditor.name")}</span>
                <span>{t("featureFlags.variationsEditor.value")}</span>
                {value.variationType === "boolean" ? null : <span />}
              </div>
              <div className="space-y-1">
                {value.variations.map((variation, index) => {
                  const nameInvalid = !variation.name.trim()
                  const valueError = getFlagVariationValueError(
                    value.variationType,
                    variation.value
                  )
                  const isJson = value.variationType === "json"
                  const isBoolean = value.variationType === "boolean"
                  const canDelete = !isBoolean && value.variations.length > 1

                  return (
                    <div
                      key={variation.id}
                      className={
                        isBoolean
                          ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 p-2"
                          : "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 p-2"
                      }
                    >
                      <div className="space-y-1">
                        <Input
                          value={variation.name}
                          disabled={disabled}
                          placeholder={t("featureFlags.variationsEditor.name")}
                          onChange={(event) =>
                            updateVariation(index, "name", event.target.value)
                          }
                        />
                        {editedFields[variation.id]?.name && nameInvalid ? (
                          <p className="text-xs text-destructive">
                            {t("featureFlags.variationsEditor.nameRequired")}
                          </p>
                        ) : null}
                      </div>
                      {isJson ? null : (
                        <div className="space-y-1">
                          <Input
                            value={variation.value}
                            disabled={
                              disabled || value.variationType === "boolean"
                            }
                            className="font-mono"
                            placeholder={t(
                              "featureFlags.variationsEditor.value"
                            )}
                            onChange={(event) =>
                              updateVariation(
                                index,
                                "value",
                                event.target.value
                              )
                            }
                          />
                          {editedFields[variation.id]?.value && valueError ? (
                            <p className="text-xs text-destructive">
                              {valueErrorMessage(valueError)}
                            </p>
                          ) : null}
                        </div>
                      )}
                      {isJson ? (
                        <div className="min-w-0 space-y-1">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            className="h-8 w-full justify-between gap-3 px-3 text-left"
                            aria-label={t(
                              "featureFlags.variationsEditor.editJsonFor",
                              { name: variation.name || untitledVariation }
                            )}
                            onClick={() => setJsonEditor(index)}
                          >
                            <code className="min-w-0 flex-1 truncate font-mono text-xs font-normal text-foreground">
                              {variation.value}
                            </code>
                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                              <Braces className="size-4" />
                              {t("featureFlags.variationsEditor.editJson")}
                            </span>
                          </Button>
                          {editedFields[variation.id]?.value && valueError ? (
                            <p className="text-xs text-destructive">
                              {valueErrorMessage(valueError)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="self-center"
                          disabled={disabled}
                          aria-label={t("featureFlags.variationsEditor.delete")}
                          onClick={() => requestRemoveVariation(index)}
                        >
                          <Trash2 />
                        </Button>
                      ) : !isBoolean ? (
                        <span />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
            {value.variationType !== "boolean" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={addVariation}
              >
                <Plus />
                {t("featureFlags.variationsEditor.add")}
              </Button>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-semibold text-foreground">
            {t("featureFlags.editor.behavior")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <DefaultVariationSelect
              label={t("featureFlags.variationsEditor.serveWhenOn")}
              value={value.enabledVariationId}
              variations={value.variations}
              disabled={disabled}
              untitledVariation={untitledVariation}
              selectedName={enabledVariation?.name}
              onChange={(enabledVariationId) =>
                onChange({ ...value, enabledVariationId })
              }
            />
            <DefaultVariationSelect
              label={t("featureFlags.variationsEditor.serveWhenOff")}
              value={value.disabledVariationId}
              variations={value.variations}
              disabled={disabled}
              untitledVariation={untitledVariation}
              selectedName={disabledVariation?.name}
              onChange={(disabledVariationId) =>
                onChange({ ...value, disabledVariationId })
              }
            />
          </div>
          {behaviorSettings}
        </section>
      </div>

      <AlertDialog
        open={Boolean(pendingVariationType)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setTypeConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("featureFlags.variationsEditor.changeTypeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("featureFlags.variationsEditor.changeTypeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button variant="outline" onClick={() => setTypeConfirmation(null)}>
              {t("featureFlags.variationsEditor.keepSettings")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingVariationType)
                  applyVariationType(pendingVariationType)
              }}
            >
              {t("featureFlags.variationsEditor.changeType")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteIndex !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("featureFlags.variationsEditor.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteVariation && pendingDeleteReplacement
                ? t("featureFlags.variationsEditor.deleteDescription", {
                    variation: pendingDeleteVariation.name || untitledVariation,
                    roles: new Intl.ListFormat(
                      i18n.resolvedLanguage === "zh" ? "zh-CN" : "en-US"
                    ).format(pendingDeleteRoles),
                    selection: t(
                      pendingDeleteRoles.length > 1
                        ? "featureFlags.variationsEditor.theseSelections"
                        : "featureFlags.variationsEditor.thisSelection"
                    ),
                    replacement:
                      pendingDeleteReplacement.name || untitledVariation,
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmation(null)}
            >
              {t("featureFlags.variationsEditor.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDeleteIndex !== null) {
                  removeVariation(pendingDeleteIndex)
                }
                setDeleteConfirmation(null)
              }}
            >
              {t("featureFlags.variationsEditor.deleteAndUpdate")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FlagJsonEditorDialog
        key={jsonEditorIndex ?? "closed"}
        open={Boolean(jsonEditorVariation)}
        variationName={jsonEditorVariation?.name || untitledVariation}
        value={jsonEditorVariation?.value ?? "{}"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setJsonEditor(null)
        }}
        onApply={(nextValue) => {
          if (jsonEditorIndex !== null) {
            updateVariation(jsonEditorIndex, "value", nextValue)
          }
          setJsonEditor(null)
        }}
      />
    </>
  )
}

function DefaultVariationSelect({
  label,
  value,
  variations,
  disabled,
  untitledVariation,
  selectedName,
  onChange,
}: {
  label: string
  value: string
  variations: FlagVariationSettingsDraft["variations"]
  disabled: boolean
  untitledVariation: string
  selectedName?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue>{selectedName || untitledVariation}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {variations.map((variation) => (
              <SelectItem key={variation.id} value={variation.id}>
                {variation.name || untitledVariation}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
