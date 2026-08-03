import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { isPolicyKeyUsed } from "../../policy-api"
import { clonePolicy, type PolicyDetail } from "../policy-details-api"

const schema = z.object({
  name: z.string().trim().min(1),
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9._-]+$/),
  description: z.string().trim().max(512),
})

type FormValues = z.infer<typeof schema>

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function ClonePolicySheet({
  open,
  policy,
  onOpenChange,
  onCloned,
}: {
  open: boolean
  policy: PolicyDetail
  onOpenChange: (open: boolean) => void
  onCloned: (policy: PolicyDetail) => void
}) {
  const { t } = useTranslation()
  const {
    register,
    reset,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) {
      reset({
        name: t("iam.policies.details.permissionsEditor.cloneName", {
          name: policy.name,
        }),
        key: `${policy.key}-copy`,
        description: policy.description ?? "",
      })
    }
  }, [open, policy, reset, t])

  async function submit(values: FormValues) {
    try {
      if (await isPolicyKeyUsed(values.key)) {
        setError("key", { message: t("iam.policies.keyUnavailable") })
        return
      }
      const cloned = await clonePolicy(policy.key, {
        originPolicyType: policy.type,
        ...values,
      })
      toast.success(t("iam.policies.operationSucceeded"))
      onCloned(cloned)
    } catch {
      toast.error(t("iam.policies.operationFailed"))
    }
  }

  const nameField = register("name")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,500px)] data-[side=right]:sm:max-w-[500px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>
            {t("iam.policies.details.permissionsEditor.clonePolicy")}
          </SheetTitle>
          <SheetDescription>
            {t("iam.policies.details.permissionsEditor.cloneDescription", {
              name: policy.name,
            })}
          </SheetDescription>
        </SheetHeader>
        <form
          id="clone-policy-form"
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
          onSubmit={handleSubmit(submit)}
        >
          <div className="space-y-2">
            <Label htmlFor="clone-policy-name">{t("iam.policies.name")}</Label>
            <Input
              id="clone-policy-name"
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
            <Label htmlFor="clone-policy-key">{t("iam.policies.key")}</Label>
            <Input
              id="clone-policy-key"
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
            <Label htmlFor="clone-policy-description">
              {t("iam.policies.description")}
            </Label>
            <Textarea
              id="clone-policy-description"
              rows={4}
              {...register("description")}
            />
          </div>
        </form>
        <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("iam.policies.cancel")}
          </Button>
          <Button
            type="submit"
            form="clone-policy-form"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t("iam.policies.details.permissionsEditor.cloning")
              : t("iam.policies.details.permissionsEditor.clone")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
