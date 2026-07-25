import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { EndUserProperty, PresetValue } from "../end-users-types"

export function PresetValuesDialog({
  property,
  saving,
  onOpenChange,
  onSave,
}: {
  property: EndUserProperty
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (
    property: EndUserProperty,
    presetValues: PresetValue[],
    usePresetValuesOnly: boolean
  ) => void
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState<PresetValue[]>(() =>
    property.presetValues.map((item) => ({ ...item }))
  )
  const [value, setValue] = useState("")
  const [description, setDescription] = useState("")
  const [only, setOnly] = useState(property.usePresetValuesOnly)
  const [error, setError] = useState("")

  function add() {
    const nextValue = value.trim()
    const nextDescription = description.trim()
    if (!nextValue || !nextDescription) return
    if (values.some((item) => item.value === nextValue)) {
      setError(t("endUsers.presetsDialog.duplicate"))
      return
    }
    setValues((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        value: nextValue,
        description: nextDescription,
      },
    ])
    setValue("")
    setDescription("")
    setError("")
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>
            {t("endUsers.presetsDialog.title", { name: property.name })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="preset-value">
                {t("endUsers.presetsDialog.value")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("endUsers.presetsDialog.valueHelp")}
              </p>
              <Input
                id="preset-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preset-description">
                {t("endUsers.presetsDialog.description")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("endUsers.presetsDialog.descriptionHelp")}
              </p>
              <Input
                id="preset-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={!value.trim() || !description.trim()}
              onClick={add}
            >
              {t("endUsers.presetsDialog.add")}
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div>
            <h3 className="mb-2 text-sm font-medium">
              {t("endUsers.presetsDialog.existing")}
            </h3>
            <div className="divide-y rounded-md border">
              {values.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground">
                      {t("endUsers.presetsDialog.value")}
                    </span>
                    <p className="truncate font-mono">{item.value}</p>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground">
                      {t("endUsers.presetsDialog.description")}
                    </span>
                    <p className="truncate">{item.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() =>
                      setValues((current) =>
                        current.filter((value) => value.id !== item.id)
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={only && values.length > 0}
              disabled={!values.length}
              onCheckedChange={(checked) => setOnly(checked === true)}
            />
            {t("endUsers.presetsDialog.only")}
          </label>
          <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
            {t("endUsers.presetsDialog.warning")}
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 justify-between border-t-0 bg-transparent px-6 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={!values.length || saving}
            onClick={() => {
              setValues([])
              setOnly(false)
            }}
          >
            {t("endUsers.presetsDialog.clearAll")}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {t("endUsers.presetsDialog.cancel")}
            </Button>
            <Button
              disabled={saving}
              onClick={() =>
                onSave(property, values, only && values.length > 0)
              }
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {t("endUsers.presetsDialog.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
