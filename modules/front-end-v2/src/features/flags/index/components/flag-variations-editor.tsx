import { Braces, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
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
import type { Lang } from "@/features/layout/layout-types"
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
  lang,
  value,
  disabled,
  showErrors,
  onChange,
  onNestedSurfaceOpenChange,
}: {
  lang: Lang
  value: FlagVariationSettingsDraft
  disabled: boolean
  showErrors: boolean
  onChange: (value: FlagVariationSettingsDraft) => void
  onNestedSurfaceOpenChange?: (open: boolean) => void
}) {
  const zh = lang === "zh"
  const [pendingVariationType, setPendingVariationType] =
    useState<FlagVariationType | null>(null)
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(
    null
  )
  const [jsonEditorIndex, setJsonEditorIndex] = useState<number | null>(null)
  const untitledVariation = zh ? "未命名变体" : "Untitled variation"
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
          ? zh
            ? "开启时返回"
            : "Serve when on"
          : null,
        value.disabledVariationId === pendingDeleteVariation.id
          ? zh
            ? "关闭时返回"
            : "Serve when off"
          : null,
      ].filter(Boolean)
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
    if (error === "required") return zh ? "请输入值" : "Enter a value"
    if (error === "boolean")
      return zh ? "请输入 true 或 false" : "Use true or false"
    if (error === "number")
      return zh ? "请输入有效数字" : "Enter a valid number"
    if (error === "json") {
      return zh
        ? "请输入有效的 JSON 对象或数组"
        : "Enter a valid JSON object or array"
    }
    return ""
  }

  return (
    <>
      <div className="space-y-5">
        <section className="space-y-4 border-t pt-5">
          <h3 className="text-base font-semibold text-foreground">
            {zh ? "变体设置" : "Variation settings"}
          </h3>

          <div className="space-y-2">
            <Label>{zh ? "变体类型" : "Variation type"}</Label>
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
              {zh
                ? "功能开关创建后不能更改变体类型。"
                : "The variation type cannot be changed after the flag is created."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{zh ? "变体" : "Variations"}</Label>
            <div className="overflow-hidden rounded-md border">
              {value.variationType === "json" ? (
                <div className="grid grid-cols-[minmax(0,1fr)_2rem] gap-2 bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <span>{zh ? "名称与 JSON 值" : "Name and JSON value"}</span>
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
                  <span>{zh ? "名称" : "Name"}</span>
                  <span>{zh ? "值" : "Value"}</span>
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
                          placeholder={zh ? "名称" : "Name"}
                          onChange={(event) =>
                            updateVariation(index, "name", event.target.value)
                          }
                        />
                        {showErrors && nameInvalid ? (
                          <p className="text-xs text-destructive">
                            {zh ? "请输入变体名称" : "Enter a variation name"}
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
                            placeholder={zh ? "值" : "Value"}
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
                          aria-label={zh ? "删除变体" : "Delete variation"}
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
                            aria-label={`${zh ? "编辑 JSON" : "Edit JSON for"} ${variation.name || untitledVariation}`}
                            onClick={() => setJsonEditor(index)}
                          >
                            <code className="min-w-0 flex-1 truncate font-mono text-xs font-normal text-foreground">
                              {variation.value}
                            </code>
                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                              <Braces className="size-4" />
                              {zh ? "编辑 JSON" : "Edit JSON"}
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
                {zh ? "添加变体" : "Add variation"}
              </Button>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 border-t pt-5">
          <h3 className="text-base font-semibold text-foreground">
            {zh ? "默认规则" : "Default rule"}
          </h3>
          <div className="space-y-3">
            <DefaultVariationSelect
              label={zh ? "开启时返回" : "Serve when on"}
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
              label={zh ? "关闭时返回" : "Serve when off"}
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
                {zh ? "创建后开启" : "Turn on after creation"}
              </span>
              <span className="text-xs text-muted-foreground">
                {zh ? (
                  <>
                    开启后，将立即应用
                    <span className="font-medium text-foreground">
                      开启时返回
                    </span>
                    中选择的值。
                  </>
                ) : (
                  <>
                    The value defined by{" "}
                    <span className="font-medium text-foreground">
                      Serve when on
                    </span>{" "}
                    will be applied immediately when enabled.
                  </>
                )}
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
              {zh ? "更改变体类型？" : "Change variation type?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {zh
                ? "更改类型会重置所有变体名称、值以及默认规则选择。"
                : "Changing the type resets all variation names, values, and default rule selections."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button variant="outline" onClick={() => setTypeConfirmation(null)}>
              {zh ? "保留当前设置" : "Keep current settings"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingVariationType)
                  applyVariationType(pendingVariationType)
              }}
            >
              {zh ? "更改类型" : "Change type"}
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
              {zh ? "删除变体？" : "Delete variation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteVariation && pendingDeleteReplacement
                ? zh
                  ? `“${pendingDeleteVariation.name || untitledVariation}”正被${pendingDeleteRoles.join("和")}使用。删除后，这些选择将更新为“${pendingDeleteReplacement.name || untitledVariation}”。`
                  : `“${pendingDeleteVariation.name || untitledVariation}” is used by ${pendingDeleteRoles.join(" and ")}. Deleting it will update ${pendingDeleteRoles.length > 1 ? "these selections" : "this selection"} to “${pendingDeleteReplacement.name || untitledVariation}”.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmation(null)}
            >
              {zh ? "取消" : "Cancel"}
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
              {zh ? "删除并更新规则" : "Delete and update rules"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FlagJsonEditorDialog
        key={jsonEditorIndex ?? "closed"}
        open={Boolean(jsonEditorVariation)}
        lang={lang}
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
