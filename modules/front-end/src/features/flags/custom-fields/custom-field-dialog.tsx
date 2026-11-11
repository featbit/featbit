import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import {
  DocSelect,
  FieldError,
} from "../documentation/components/documentation-ui"
import { useDocumentationCopy } from "../documentation/use-documentation-copy"
import {
  controlTypes,
  newControl,
  type CustomControl,
  type CustomField,
} from "./custom-fields-model"

export function CustomFieldDialog({
  field,
  fields,
  projectName,
  onClose,
  onSave,
  onRemove,
}: {
  field: CustomField | null
  fields: CustomField[]
  projectName: string
  onClose: () => void
  onSave: (field: CustomField) => boolean
  onRemove: (id: string) => boolean
}) {
  const { t } = useDocumentationCopy()
  const [name, setName] = useState(field?.name ?? "")
  const [required, setRequired] = useState(field?.required ?? false)
  const [controls, setControls] = useState<CustomControl[]>(
    field?.controls ?? []
  )
  const [error, setError] = useState("")
  const [confirmRemove, setConfirmRemove] = useState(false)
  function save() {
    if (!name.trim()) {
      setError(t("fieldNameRequired"))
      return
    }
    if (
      fields.some(
        (other) =>
          other.id !== field?.id &&
          other.name.toLowerCase() === name.trim().toLowerCase()
      )
    ) {
      setError(t("duplicateField"))
      return
    }
    if (!controls.length || controls.some((control) => !control.label.trim())) {
      setError(t("controlsRequired"))
      return
    }
    if (
      new Set(controls.map((control) => control.label.trim().toLowerCase()))
        .size !== controls.length
    ) {
      setError(t("duplicateControl"))
      return
    }
    const id = field?.id ?? crypto.randomUUID()
    if (
      onSave({
        id,
        key: field?.key ?? id,
        name: name.trim(),
        required,
        controls: controls.map((control) => ({
          ...control,
          label: control.label.trim(),
        })),
      })
    )
      onClose()
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t(field ? "editCustomField" : "addCustomField")}
          </DialogTitle>
          <DialogDescription>
            {t("fieldScope", { project: projectName })}
            <span className="mt-2 block">{t("projectPermission")}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 overflow-y-auto px-0.5 py-1">
          <div className="space-y-2">
            <Label htmlFor="custom-field-name">{t("fieldName")}</Label>
            <Input
              id="custom-field-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("fieldNamePlaceholder")}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="custom-field-required">{t("required")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("requiredHelp")}
              </p>
            </div>
            <Switch
              id="custom-field-required"
              checked={required}
              onCheckedChange={setRequired}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("controls")}</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setControls([...controls, newControl("markdown", "")])
                }
              >
                <Plus className="size-3.5" />
                {t("addControl")}
              </Button>
            </div>
            {!controls.length ? (
              <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                {t("controlsEmpty")}
              </p>
            ) : null}
            {controls.map((control, index) => (
              <div
                key={control.id}
                className="space-y-3 rounded-lg border bg-muted/10 p-3"
                data-testid="custom-control-definition"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("controlNumber", { count: index + 1 })}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("removeControl", { count: index + 1 })}
                    onClick={() =>
                      setControls(
                        controls.filter((item) => item.id !== control.id)
                      )
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                  <div className="space-y-2">
                    <Label htmlFor={`control-label-${control.id}`}>
                      {t("controlLabel")}
                    </Label>
                    <Input
                      id={`control-label-${control.id}`}
                      value={control.label}
                      onChange={(event) =>
                        setControls(
                          controls.map((item) =>
                            item.id === control.id
                              ? { ...item, label: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`control-type-${control.id}`}>
                      {t("controlType")}
                    </Label>
                    <DocSelect
                      id={`control-type-${control.id}`}
                      value={control.type}
                      options={controlTypes.map((type) => ({
                        value: type,
                        label: t(`controlTypes.${type}`),
                      }))}
                      onChange={(type) =>
                        setControls(
                          controls.map((item) =>
                            item.id === control.id
                              ? { ...item, type: type as CustomControl["type"] }
                              : item
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <FieldError message={error} />
          {confirmRemove ? (
            <div className="space-y-3 rounded-lg border border-destructive/30 p-3">
              <p className="text-sm">
                {t("removeFieldHelp", { name: field?.name })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (field && onRemove(field.id)) onClose()
                  }}
                >
                  {t("confirmRemove")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmRemove(false)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t pt-4">
          {field ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 className="size-3.5" />
              {t("removeField")}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={save}>
            {t("saveField")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
