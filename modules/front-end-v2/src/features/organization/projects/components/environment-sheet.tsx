import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { slugify } from "@/features/organization/organization-utils"
import type { ProjectEnvironment } from "@/features/organization/projects/projects-api"
import { Field } from "./form-field"

export type EnvironmentValues = {
  name: string
  key: string
  description: string
  requireChangeComment: boolean
}

export function EnvironmentSheet({
  open,
  environment,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  environment: ProjectEnvironment | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: EnvironmentValues) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const isEditing = Boolean(environment?.id)
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("organization.validation.nameRequired")),
        key: z.string().trim().min(1, t("organization.validation.keyRequired")),
        description: z.string(),
        requireChangeComment: z.boolean(),
      }),
    [t]
  )
  const form = useForm<EnvironmentValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      key: "",
      description: "",
      requireChangeComment: false,
    },
  })

  useEffect(() => {
    form.reset({
      name: environment?.name ?? "",
      key: environment?.key ?? "",
      description: environment?.description ?? "",
      requireChangeComment: environment?.settings.requireChangeComment ?? false,
    })
  }, [environment, form, open])

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
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,480px)] data-[side=right]:sm:max-w-[480px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>
            {isEditing
              ? t("organization.projects.forms.editEnvironment")
              : t("organization.projects.forms.createEnvironment")}
          </SheetTitle>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <Field
              id="environmentName"
              label={t("organization.projects.fields.name")}
              error={form.formState.errors.name?.message}
            >
              <Input
                id="environmentName"
                disabled={saving}
                value={form.watch("name")}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </Field>
            <Field
              id="environmentKey"
              label={t("organization.projects.fields.key")}
              error={form.formState.errors.key?.message}
            >
              <Input
                id="environmentKey"
                disabled={saving || isEditing}
                {...form.register("key")}
              />
            </Field>
            <Field
              id="environmentDescription"
              label={t("organization.projects.fields.description")}
            >
              <Textarea
                id="environmentDescription"
                disabled={saving}
                className="min-h-20 resize-none"
                {...form.register("description")}
              />
            </Field>
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <Checkbox
                checked={form.watch("requireChangeComment")}
                disabled={saving}
                onCheckedChange={(checked) =>
                  form.setValue("requireChangeComment", checked === true, {
                    shouldDirty: true,
                  })
                }
              />
              <span className="space-y-1">
                <span className="block font-medium">
                  {t("organization.projects.fields.requireChangeComment")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("organization.projects.helper.requireChangeComment")}
                </span>
              </span>
            </label>
          </div>
          <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {isEditing
                ? t("organization.projects.actions.saveEnvironment")
                : t("organization.projects.actions.createEnvironment")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
