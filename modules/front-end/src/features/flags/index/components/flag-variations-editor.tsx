import { Braces, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
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
  showErrors,
  onChange,
  onNestedSurfaceOpenChange,
}: {
  value: FlagVariationSettingsDraft
  disabled: boolean
  showErrors: boolean
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
    onChange({ ...nextValue, isEnabled: value.isEnabled })
    setTypeConfirmation(null)
  }

  function updateVariation(
    index: number,
    field: "name" | "value",
    fieldValue: string
  ) {
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
    onChange({
      ...value,
      variations: [
        ...value.variations,
        {
          id: crypto.randomUUID(),
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
        <section className="space-y-4 border-t pt-5">
          <h3 className="text-base font-semibold text-foreground">
            {t("featureFlags.variationsEditor.title")}
          </h3>

          <div className="space-y-2">
            <Label>{t("featureFlags.variationsEditor.type")}</Label>
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
              <SelectTrigger className="w-full sm:max-w-[280px]">
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
            <p className="text-xs text-muted-foreground">
              {t("featureFlags.variationsEditor.typeHelp")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("featureFlags.variationsEditor.variations")}</Label>
            <div className="overflow-hidden rounded-md border">
              {value.variationType === "json" ? (
                <div className="grid grid-cols-[minmax(0,1fr)_2rem] gap-2 bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <span>{t("featureFlags.variationsEditor.nameAndJson")}</span>
                  <span />
                </div>
              ) : (
                <div
                  className={
                    value.variationType === "boolean"
                      ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground"
                      : "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  <span>{t("featureFlags.variationsEditor.name")}</span>
                  <span>{t("featureFlags.variationsEditor.value")}</span>
                  {value.variationType === "boolean" ? null : <span />}
                </div>
              )}
              <div className="divide-y">
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
                        isJson
                          ? "grid grid-cols-[minmax(0,1fr)_2rem] gap-2 p-2"
                          : isBoolean
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
                        {showErrors && nameInvalid ? (
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
                          {showErrors && valueError ? (
                            <p className="text-xs text-destructive">
                              {valueErrorMessage(valueError)}
                            </p>
                          ) : null}
                        </div>
                      )}
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
                      {isJson ? (
                        <div className="col-span-2 space-y-1">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            className="h-10 w-full justify-between gap-3 px-3 text-left"
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
                          {showErrors && valueError ? (
                            <p className="text-xs text-destructive">
                              {valueErrorMessage(valueError)}
                            </p>
                          ) : null}
                        </div>
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

        <section className="space-y-4 border-t pt-5">
          <h3 className="text-base font-semibold text-foreground">
            {t("featureFlags.variationsEditor.defaultRule")}
          </h3>
          <div className="space-y-3">
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

          <label className="flex w-full items-center justify-between rounded-md border px-3 py-3 sm:max-w-[420px]">
            <span>
              <span className="block text-sm font-medium">
                {t("featureFlags.variationsEditor.turnOn")}
              </span>
              <span className="text-xs text-muted-foreground">
                <Trans
                  i18nKey="featureFlags.variationsEditor.turnOnHelp"
                  components={{
                    strong: <span className="font-medium text-foreground" />,
                  }}
                />
              </span>
            </span>
            <Switch
              checked={value.isEnabled}
              disabled={disabled}
              onCheckedChange={(isEnabled) => onChange({ ...value, isEnabled })}
            />
          </label>
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
        <SelectTrigger className="w-full sm:max-w-[420px]">
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
