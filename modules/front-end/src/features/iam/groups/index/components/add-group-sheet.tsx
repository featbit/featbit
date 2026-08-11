import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { createGroup, isGroupNameUsed } from "../../group-api"

const schema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim(),
})

type FormValues = z.infer<typeof schema>

export function AddGroupSheet({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  })

  async function submit(values: FormValues) {
    try {
      if (await isGroupNameUsed(values.name)) {
        setError("name", { message: t("iam.groups.groupNameUnavailable") })
        return
      }
      await createGroup(values)
      toast.success(t("iam.groups.operationSucceeded"))
      onAdded()
    } catch {
      toast.error(t("iam.groups.operationFailed"))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,500px)] data-[side=right]:sm:max-w-[500px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>{t("iam.groups.addGroupTitle")}</SheetTitle>
        </SheetHeader>
        <form
          id="add-group-form"
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
          onSubmit={handleSubmit(submit)}
        >
          <div className="space-y-2">
            <Label htmlFor="group-name">{t("iam.groups.groupName")}</Label>
            <Input
              id="group-name"
              placeholder={t("iam.groups.groupNamePlaceholder")}
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-sm text-destructive">
                {errors.name.message === t("iam.groups.groupNameUnavailable")
                  ? t("iam.groups.groupNameUnavailable")
                  : t("iam.groups.groupNameRequired")}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-description">
              {t("iam.groups.groupDescription")}
            </Label>
            <Textarea
              id="group-description"
              rows={4}
              placeholder={t("iam.groups.groupDescriptionPlaceholder")}
              {...register("description")}
            />
          </div>
        </form>
        <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="submit" form="add-group-form" disabled={isSubmitting}>
            {isSubmitting ? t("iam.groups.saving") : t("iam.groups.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
