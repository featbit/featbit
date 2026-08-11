import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import type { EndUserProperty } from "../end-users-types"
import { TruncatedValue } from "./shared"

export type PropertyDraft = {
  id: string
  name: string
  remark: string
  isDigestField: boolean
}

export function PropertyRow({
  property,
  editing,
  editRemark,
  saving,
  digestChecked,
  onEditRemark,
  onEdit,
  onCancel,
  onSave,
  onToggleDigest,
  onPresets,
  onRemove,
}: {
  property: EndUserProperty
  editing: boolean
  editRemark: string
  saving: boolean
  digestChecked: boolean
  onEditRemark: (remark: string) => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onToggleDigest: (checked: boolean) => void
  onPresets: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const digestDisabled = property.isBuiltIn
  return (
    <TableRow>
      <TableCell className="truncate px-4 py-3 font-medium">
        {property.name}
      </TableCell>
      <TableCell className="px-4 py-3 text-center">
        <Checkbox
          checked={digestChecked}
          disabled={digestDisabled}
          className={
            digestDisabled
              ? "cursor-not-allowed border-muted-foreground/30 bg-muted disabled:opacity-100 data-checked:border-muted-foreground/50 data-checked:bg-muted-foreground/50 data-checked:text-background"
              : "cursor-pointer"
          }
          onCheckedChange={(checked) => onToggleDigest(checked === true)}
        />
      </TableCell>
      <TableCell className="px-4 py-3">
        {editing ? (
          <Input
            value={editRemark}
            onChange={(event) => onEditRemark(event.target.value)}
          />
        ) : (
          <TruncatedValue value={property.remark} muted />
        )}
      </TableCell>
      <TableCell className="px-4 py-3">
        {property.isBuiltIn ? (
          <span className="text-sm text-muted-foreground">
            {t("endUsers.propertiesDrawer.builtIn")}
          </span>
        ) : editing ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={onSave}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {t("endUsers.propertiesDrawer.save")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={onCancel}
            >
              {t("endUsers.propertiesDrawer.cancel")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Button variant="link" className="h-auto px-2" onClick={onEdit}>
              {t("endUsers.propertiesDrawer.edit")}
            </Button>
            <Button variant="link" className="h-auto px-2" onClick={onPresets}>
              {t("endUsers.propertiesDrawer.presetValues", {
                count: property.presetValues.length,
              })}
            </Button>
            <Button
              variant="link"
              className="h-auto px-2 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              {t("endUsers.propertiesDrawer.remove")}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

export function NewPropertyRow({
  draft,
  error,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  draft: PropertyDraft
  error: string
  saving: boolean
  onChange: (draft: PropertyDraft) => void
  onSave: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <TableRow className="bg-muted/20">
      <TableCell className="px-4 py-3 align-top">
        <Input
          value={draft.name}
          autoFocus
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
        {error ? (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        ) : null}
      </TableCell>
      <TableCell className="px-4 py-3 text-center align-top">
        <Checkbox
          checked={draft.isDigestField}
          className="cursor-pointer disabled:cursor-not-allowed"
          onCheckedChange={(checked) =>
            onChange({ ...draft, isDigestField: checked === true })
          }
        />
      </TableCell>
      <TableCell className="px-4 py-3 align-top">
        <Input
          value={draft.remark}
          onChange={(event) =>
            onChange({ ...draft, remark: event.target.value })
          }
        />
      </TableCell>
      <TableCell className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={saving} onClick={onSave}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {t("endUsers.propertiesDrawer.save")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={onCancel}
          >
            {t("endUsers.propertiesDrawer.cancel")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
