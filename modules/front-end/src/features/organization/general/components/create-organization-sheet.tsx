import { Check, Loader2, Save } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Field,
  OrganizationInput,
} from "@/features/organization/general/components/organization-form-fields"
import { slugify } from "@/features/organization/organization-utils"

export type CreateOrganizationValues = {
  name: string
  key: string
}

export function CreateOrganizationSheet({
  open,
  isCreating,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  isCreating: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: CreateOrganizationValues) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("organization.validation.nameRequired")),
        key: z.string().trim().min(1, t("organization.validation.keyRequired")),
      }),
    [t]
  )
  const form = useForm<CreateOrganizationValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      key: "",
    },
    mode: "onChange",
  })
  const nameValue = useWatch({
    control: form.control,
    name: "name",
  })
  const keyValue = useWatch({
    control: form.control,
    name: "key",
  })

  useEffect(() => {
    if (!open) {
      form.reset({
        name: "",
        key: "",
      })
    }
  }, [form, open])

  function onNameChange(value: string) {
    const key = slugify(value)

    form.setValue("name", value, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue("key", key, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,460px)] data-[side=right]:sm:max-w-[460px]">
        <SheetHeader className="px-6 py-5 pr-12">
          <SheetTitle>{t("organization.create.title")}</SheetTitle>
          <SheetDescription>
            {t("organization.create.description")}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <Field
              id="createOrganizationName"
              label={t("organization.identity.name")}
              error={form.formState.errors.name?.message}
            >
              <OrganizationInput
                id="createOrganizationName"
                disabled={isCreating}
                error={form.formState.errors.name?.message}
                value={nameValue}
                placeholder={t("organization.create.namePlaceholder")}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </Field>

            <Field
              id="createOrganizationKey"
              label={t("organization.identity.key")}
              error={form.formState.errors.key?.message}
            >
              <OrganizationInput
                id="createOrganizationKey"
                disabled={isCreating}
                error={form.formState.errors.key?.message}
                {...form.register("key")}
                placeholder={t("organization.create.keyPlaceholder")}
              />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t("organization.create.keyHelper")}
                </p>
                {keyValue ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="size-3.5" />
                    {t("organization.create.keyAvailable")}
                  </p>
                ) : null}
              </div>
            </Field>
          </div>

          <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t("organization.actions.createOrganization")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
