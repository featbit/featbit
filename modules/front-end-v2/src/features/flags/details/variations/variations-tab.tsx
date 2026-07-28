import { Braces, GripVertical, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FlagJsonEditorDialog } from "../../index/components/flag-json-editor-dialog"
import type { FeatureFlag, FlagVariation } from "../../flags-types"
import { useVariationDragPreview } from "./variation-drag-preview"
import {
  variationReferences,
  variationValueError,
} from "./variations-utils"

export function VariationsTab({
  flag,
  dirty,
  saving,
  canUpdate,
  onChange,
  onDiscard,
  onReview,
}: {
  flag: FeatureFlag
  dirty: boolean
  saving: boolean
  canUpdate: boolean
  onChange: (variations: FlagVariation[]) => void
  onDiscard: () => void
  onReview: () => void
}) {
  const { t } = useTranslation()
  const variations = flag.variations ?? []
  const [showErrors, setShowErrors] = useState(false)
  const [jsonIndex, setJsonIndex] = useState<number | null>(null)
  const [dragVariationId, setDragVariationId] = useState<string | null>(null)
  const { startPreview, movePreview, removePreview } =
    useVariationDragPreview()
  const editable = canUpdate && !flag.isArchived && !saving
  const canAdd = flag.variationType !== "boolean"

  const references = variations.map((variation) =>
    variationReferences(flag, variation.id, {
      defaultOff: t("featureFlags.detailsPage.variations.defaultOff"),
      defaultOn: t("featureFlags.detailsPage.variations.defaultOn"),
      rules: (count) =>
        t("featureFlags.detailsPage.variations.rules", { count }),
      users: (count) =>
        t("featureFlags.detailsPage.variations.users", { count }),
    })
  )
  const invalid = variations.some(
    (variation) =>
      !variation.name.trim() ||
      Boolean(variationValueError(flag.variationType, variation.value))
  )

  function update(index: number, field: "name" | "value", value: string) {
    onChange(
      variations.map((variation, candidate) =>
        candidate === index ? { ...variation, [field]: value } : variation
      )
    )
  }

  function addVariation() {
    onChange([
      ...variations,
      {
        id: crypto.randomUUID(),
        name: "",
        value: flag.variationType === "json" ? "{}" : "",
      },
    ])
  }

  function review() {
    setShowErrors(true)
    if (!invalid) onReview()
  }

  return (
    <div className="pt-3">
      <section className="space-y-4">
        <div className="flex min-h-12 items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">
              {t("featureFlags.detailsPage.variations.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("featureFlags.detailsPage.variations.help")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {dirty ? (
              <Button variant="outline" disabled={saving} onClick={onDiscard}>
                {t("featureFlags.detailsPage.discard")}
              </Button>
            ) : null}
            <Button disabled={!dirty || saving} onClick={review}>
              {t("featureFlags.detailsPage.reviewAndSave")}
            </Button>
          </div>
        </div>

        <div className="flex h-12 items-center gap-3 rounded-lg bg-muted/60 px-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {t("featureFlags.detailsPage.variations.dataType")}
            </span>
            <Badge variant="outline" className="bg-background font-normal">
              {flag.variationType.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <div
            data-variations-table
            className="overflow-hidden rounded-lg border"
          >
            <div className="grid grid-cols-[3rem_minmax(10rem,15rem)_minmax(14rem,1fr)_13rem_3.75rem] items-center border-b bg-muted/30 px-3 py-3 text-sm font-medium">
              <span />
              <span>{t("featureFlags.detailsPage.variations.name")}</span>
              <span>{t("featureFlags.detailsPage.variations.value")}</span>
              <span>{t("featureFlags.detailsPage.variations.usedBy")}</span>
              <span />
            </div>
            <div className="divide-y">
            {variations.map((variation, index) => {
              const nameError = showErrors && !variation.name.trim()
              const valueError =
                showErrors &&
                variationValueError(flag.variationType, variation.value)
              const reference = references[index]
              return (
                <div
                  key={variation.id}
                  data-variation-id={variation.id}
                  data-variation-drag-row
                  onDragOver={(event) => {
                    if (!editable) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = "move"
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (!editable) return
                    const sourceId =
                      event.dataTransfer.getData("text/plain") ||
                      dragVariationId
                    const next = [...variations]
                    const sourceIndex = next.findIndex(
                      (candidate) => candidate.id === sourceId
                    )
                    if (sourceIndex >= 0 && sourceIndex !== index) {
                      const [moved] = next.splice(sourceIndex, 1)
                      next.splice(index, 0, moved)
                      onChange(next)
                    }
                    removePreview()
                    setDragVariationId(null)
                  }}
                  className={
                    dragVariationId === variation.id
                      ? "grid grid-cols-[3rem_minmax(10rem,15rem)_minmax(14rem,1fr)_13rem_3.75rem] items-start px-3 py-2.5 opacity-35 transition-opacity"
                      : "grid grid-cols-[3rem_minmax(10rem,15rem)_minmax(14rem,1fr)_13rem_3.75rem] items-start px-3 py-2.5 transition-opacity"
                  }
                >
                  <button
                    type="button"
                    draggable={editable}
                    disabled={!editable}
                    className="mt-1.5 flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:cursor-default"
                    aria-label={t(
                      "featureFlags.detailsPage.variations.reorder",
                      { name: variation.name }
                    )}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move"
                      event.dataTransfer.setData("text/plain", variation.id)
                      startPreview(event)
                      setDragVariationId(variation.id)
                    }}
                    onDrag={(event) =>
                      movePreview(event.clientX, event.clientY)
                    }
                    onDragEnd={() => {
                      removePreview()
                      setDragVariationId(null)
                    }}
                  >
                    <GripVertical className="size-4" />
                  </button>
                  <div className="pr-4">
                    <Input
                      value={variation.name}
                      disabled={!editable}
                      aria-invalid={nameError}
                      onChange={(event) =>
                        update(index, "name", event.target.value)
                      }
                    />
                    {nameError ? (
                      <p className="mt-1 text-xs text-destructive">
                        {t("featureFlags.detailsPage.variations.nameRequired")}
                      </p>
                    ) : null}
                  </div>
                  <div className="pr-4">
                    {flag.variationType === "json" ? (
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                        disabled={!editable}
                        onClick={() => setJsonIndex(index)}
                      >
                        <code className="min-w-0 truncate text-xs">
                          {variation.value}
                        </code>
                        <span className="ml-3 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Braces className="size-4" />
                          {t("featureFlags.detailsPage.variations.editJson")}
                        </span>
                      </Button>
                    ) : (
                      <Input
                        className="font-mono"
                        value={variation.value}
                        disabled={!editable || flag.variationType === "boolean"}
                        aria-invalid={Boolean(valueError)}
                        onChange={(event) =>
                          update(index, "value", event.target.value)
                        }
                      />
                    )}
                    {valueError ? (
                      <p className="mt-1 text-xs text-destructive">
                        {t(
                          `featureFlags.detailsPage.variations.errors.${valueError}`
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="pt-2 text-sm text-muted-foreground">
                    {reference.labels.join(", ") ||
                      t("featureFlags.detailsPage.variations.notUsed")}
                  </div>
                  <div className="flex justify-end">
                    <Tooltip>
                      <TooltipTrigger
                        render={<span className="inline-flex" />}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          disabled={
                            !editable ||
                            flag.variationType === "boolean" ||
                            reference.count > 0 ||
                            variations.length <= 1
                          }
                          aria-label={`${t(
                            "featureFlags.detailsPage.variations.remove"
                          )}: ${variation.name}`}
                          onClick={() =>
                            onChange(
                              variations.filter(
                                (candidate) => candidate.id !== variation.id
                              )
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {reference.count
                          ? t(
                              "featureFlags.detailsPage.variations.reassignFirst"
                            )
                          : t("featureFlags.detailsPage.variations.remove")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )
            })}
            </div>
          </div>
          {canAdd ? (
            <Button
              data-variation-add-action
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              disabled={!editable}
              onClick={addVariation}
            >
              <span className="inline-flex items-center gap-1 leading-none">
                <Plus className="size-3.5 -translate-y-px" />
                <span>{t("featureFlags.detailsPage.variations.add")}</span>
              </span>
            </Button>
          ) : null}
        </div>

        <div className="rounded-lg bg-muted/50 px-4 py-4">
          <p className="text-sm font-medium">
            {t("featureFlags.detailsPage.variations.safeguards")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("featureFlags.detailsPage.variations.safeguardsHelp")}
          </p>
        </div>
      </section>

      <FlagJsonEditorDialog
        key={jsonIndex ?? "closed"}
        open={jsonIndex !== null}
        variationName={
          jsonIndex === null
            ? ""
            : variations[jsonIndex]?.name ||
              t("featureFlags.detailsPage.variations.untitled")
        }
        value={jsonIndex === null ? "{}" : variations[jsonIndex]?.value || "{}"}
        onOpenChange={(open) => !open && setJsonIndex(null)}
        onApply={(value) => {
          if (jsonIndex !== null) update(jsonIndex, "value", value)
          setJsonIndex(null)
        }}
      />
    </div>
  )
}
