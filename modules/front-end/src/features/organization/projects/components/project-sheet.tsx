import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { slugify } from "@/features/organization/organization-utils"
import type { OrganizationProject } from "@/features/organization/projects/projects-api"
import { Field } from "./form-field"

export type ProjectValues = {
  name: string
  key: string
}

export function ProjectSheet({
  open,
  project,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  project: OrganizationProject | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ProjectValues) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const isEditing = Boolean(project?.id)
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("organization.validation.nameRequired")),
        key: z.string().trim().min(1, t("organization.validation.keyRequired")),
      }),
    [t]
  )
  const form = useForm<ProjectValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", key: "" },
  })

  useEffect(() => {
    form.reset({
      name: project?.name ?? "",
      key: project?.key ?? "",
    })
  }, [form, open, project])

  function onNameChange(value: string) {
    form.setValue("name", value, { shouldDirty: true, shouldValidate: true })
    if (!isEditing) {
      form.setValue("key", slugify(value), {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,460px)] data-[side=right]:sm:max-w-[460px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>
            {isEditing
              ? t("organization.projects.forms.editProject")
              : t("organization.projects.forms.createProject")}
          </SheetTitle>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <Field
              id="projectName"
              label={t("organization.projects.fields.name")}
              error={form.formState.errors.name?.message}
            >
              <Input
                id="projectName"
                disabled={saving}
                value={form.watch("name")}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </Field>
            <Field
              id="projectKey"
              label={t("organization.projects.fields.key")}
              error={form.formState.errors.key?.message}
            >
              <Input
                id="projectKey"
                disabled={saving || isEditing}
                {...form.register("key")}
              />
            </Field>
          </div>
          <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {isEditing
                ? t("organization.projects.actions.saveProject")
                : t("organization.projects.actions.createProject")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
