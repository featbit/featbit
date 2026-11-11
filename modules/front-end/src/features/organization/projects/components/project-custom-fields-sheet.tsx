import { Plus, Settings2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CustomFieldDialog } from "@/features/flags/custom-fields/custom-field-dialog"
import type { CustomField } from "@/features/flags/custom-fields/custom-fields-model"
import { useProjectCustomFields } from "@/features/flags/custom-fields/use-project-custom-fields"
import { useDocumentationCopy } from "@/features/flags/documentation/use-documentation-copy"
import type { OrganizationProject } from "../projects-api"

export function ProjectCustomFieldsSheet({
  project,
  canConfigure,
  onClose,
}: {
  project: OrganizationProject
  canConfigure: boolean
  onClose: () => void
}) {
  const { t } = useDocumentationCopy()
  const { fields, saveField } = useProjectCustomFields(project.id, canConfigure)
  const [editing, setEditing] = useState<CustomField | "new" | null>(null)
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,760px)] data-[side=right]:sm:max-w-[760px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>
            {t("projectFieldsTitle", { project: project.name })}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {t("projectFieldsHelp")}
          </p>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {t("projectPermission")}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={!canConfigure}
              onClick={() => setEditing("new")}
              className="shrink-0"
            >
              <Plus className="size-3.5" />
              {t("customField")}
            </Button>
          </div>
          {fields.length ? (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("fieldName")}</TableHead>
                    <TableHead>{t("controls")}</TableHead>
                    <TableHead className="w-20">{t("required")}</TableHead>
                    {canConfigure ? (
                      <TableHead className="w-16">{t("actions")}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field) => (
                    <TableRow key={field.id}>
                      <TableCell className="align-top font-medium">
                        {field.name}
                      </TableCell>
                      <TableCell className="space-y-2 align-top">
                        {field.controls.map((control) => (
                          <div key={control.id} className="space-y-1">
                            <p className="text-xs">{control.label}</p>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal"
                            >
                              {t(`controlTypes.${control.type}`)}
                            </Badge>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal"
                        >
                          {t(field.required ? "required" : "optional")}
                        </Badge>
                      </TableCell>
                      {canConfigure ? (
                        <TableCell className="align-top">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("editFieldNamed", {
                              name: field.name,
                            })}
                            onClick={() => setEditing(field)}
                          >
                            <Settings2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm font-medium">{t("noFields")}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("projectFieldsEmpty")}
              </p>
            </div>
          )}
        </div>
        <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("done")}
          </Button>
        </SheetFooter>
        {editing && canConfigure ? (
          <CustomFieldDialog
            key={editing === "new" ? "new" : editing.id}
            field={editing === "new" ? null : editing}
            fields={fields}
            projectName={project.name}
            onClose={() => setEditing(null)}
            onSave={saveField}
            onRemove={(id) => saveField(null, id)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
