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
import { createPolicy, isPolicyKeyUsed } from "../../policy-api"

const schema = z.object({
  name: z.string().trim().min(1),
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9._-]+$/),
  description: z.string().trim(),
})

type FormValues = z.infer<typeof schema>

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function AddPolicySheet({
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", key: "", description: "" },
  })
  const nameField = register("name")

  async function submit(values: FormValues) {
    try {
      if (await isPolicyKeyUsed(values.key)) {
        setError("key", { message: t("iam.policies.keyUnavailable") })
        return
      }
      await createPolicy(values)
      toast.success(t("iam.policies.operationSucceeded"))
      onAdded()
    } catch {
      toast.error(t("iam.policies.operationFailed"))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,500px)] data-[side=right]:sm:max-w-[500px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>{t("iam.policies.addPolicyTitle")}</SheetTitle>
        </SheetHeader>
        <form
          id="add-policy-form"
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
          onSubmit={handleSubmit(submit)}
        >
          <div className="space-y-2">
            <Label htmlFor="policy-name">{t("iam.policies.name")}</Label>
            <Input
              id="policy-name"
              placeholder={t("iam.policies.namePlaceholder")}
              aria-invalid={Boolean(errors.name)}
              {...nameField}
              onChange={(event) => {
                void nameField.onChange(event)
                setValue("key", slugify(event.target.value), {
                  shouldValidate: Boolean(errors.key),
                })
              }}
            />
            {errors.name ? (
              <p className="text-sm text-destructive">
                {t("iam.policies.nameRequired")}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-key">{t("iam.policies.key")}</Label>
            <Input
              id="policy-key"
              placeholder={t("iam.policies.keyPlaceholder")}
              aria-invalid={Boolean(errors.key)}
              {...register("key")}
            />
            <p className="text-xs text-muted-foreground">
              {t("iam.policies.keyHint")}
            </p>
            {errors.key ? (
              <p className="text-sm text-destructive">
                {errors.key.message === t("iam.policies.keyUnavailable")
                  ? t("iam.policies.keyUnavailable")
                  : t("iam.policies.keyInvalid")}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-description">
              {t("iam.policies.description")}
            </Label>
            <Textarea
              id="policy-description"
              rows={4}
              placeholder={t("iam.policies.descriptionPlaceholder")}
              {...register("description")}
            />
          </div>
        </form>
        <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="submit" form="add-policy-form" disabled={isSubmitting}>
            {isSubmitting ? t("iam.policies.saving") : t("iam.policies.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
