import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  createAccessToken,
  isAccessTokenNameUsed,
  updateAccessToken,
} from "../access-tokens-api"
import {
  PERMISSION_CATEGORIES,
  permissionDraftFromStatements,
  permissionDraftToStatements,
} from "../access-token-permissions"
import type {
  AccessToken,
  AccessTokenSheetMode,
  AccessTokenType,
  PermissionDraft,
  UserPolicy,
} from "../access-token-types"
import { PermissionsEditor } from "./permissions-editor"

type FormValues = {
  name: string
  type: AccessTokenType
}

function permissionDraftIsValid(draft: PermissionDraft) {
  const selectedCategories = PERMISSION_CATEGORIES.filter(
    (category) => draft[category.type].selectedActions.length > 0
  )

  if (!selectedCategories.length) return false

  return selectedCategories.every((category) => {
    const categoryDraft = draft[category.type]
    return (
      !category.supportsSpecific ||
      categoryDraft.scope === "all" ||
      categoryDraft.specificResources.length > 0
    )
  })
}

export function AccessTokenSheet({
  open,
  mode,
  token,
  policies,
  fineGrainedGranted,
  canManagePersonal,
  canManageService,
  onOpenChange,
  onCreated,
  onSaved,
}: {
  open: boolean
  mode: AccessTokenSheetMode
  token: AccessToken | null
  policies: UserPolicy[]
  fineGrainedGranted: boolean
  canManagePersonal: boolean
  canManageService: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (result: { name: string; token: string }) => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const portalContainer = useRef<HTMLDivElement | null>(null)
  const readOnly = mode === "view"
  const defaultType: AccessTokenType =
    token?.type ?? (canManagePersonal ? "Personal" : "Service")
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("accessTokens.sheet.nameRequired")),
        type: z.enum(["Personal", "Service"]),
      }),
    [t]
  )
  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: token?.name ?? "",
      type: defaultType,
    },
  })
  const type = useWatch({ control, name: "type" })
  const name = useWatch({ control, name: "name" })
  const [permissions, setPermissions] = useState(() =>
    permissionDraftFromStatements(token?.permissions, fineGrainedGranted)
  )
  const [permissionValidationAttempted, setPermissionValidationAttempted] =
    useState(false)
  const [nameAvailabilityError, setNameAvailabilityError] = useState("")
  const [checkingName, setCheckingName] = useState(false)
  const [typeError, setTypeError] = useState("")
  const [saving, setSaving] = useState(false)
  const originalName = token?.name.trim() ?? ""
  const nameField = register("name")

  const title =
    mode === "new"
      ? t("accessTokens.sheet.newTitle")
      : mode === "edit"
        ? t("accessTokens.sheet.editTitle")
        : t("accessTokens.sheet.viewTitle")
  const subtitle =
    mode === "new"
      ? t("accessTokens.sheet.newSubtitle")
      : mode === "edit"
        ? t("accessTokens.sheet.editSubtitle")
        : t("accessTokens.sheet.viewSubtitle")

  useEffect(() => {
    if (readOnly) return

    const trimmedName = name.trim()

    if (!trimmedName || trimmedName === originalName) {
      return
    }

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setCheckingName(true)
      isAccessTokenNameUsed(trimmedName)
        .then((used) => {
          if (!cancelled) {
            setNameAvailabilityError(
              used ? t("accessTokens.sheet.nameDuplicate") : ""
            )
          }
        })
        .catch(() => {
          if (!cancelled) {
            setNameAvailabilityError(
              t("accessTokens.sheet.nameValidationFailed")
            )
          }
        })
        .finally(() => {
          if (!cancelled) setCheckingName(false)
        })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [name, originalName, readOnly, t])

  function canManageType(nextType: AccessTokenType) {
    return nextType === "Personal" ? canManagePersonal : canManageService
  }

  async function validateName(trimmedName: string) {
    if (trimmedName === originalName) return true

    setCheckingName(true)
    try {
      const used = await isAccessTokenNameUsed(trimmedName)
      setNameAvailabilityError(
        used ? t("accessTokens.sheet.nameDuplicate") : ""
      )
      return !used
    } catch {
      setNameAvailabilityError(t("accessTokens.sheet.nameValidationFailed"))
      return false
    } finally {
      setCheckingName(false)
    }
  }

  function focusFirstPermissionError() {
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          "[data-access-token-sheet] [data-permission-error='true']"
        )
        ?.focus()
    })
  }

  async function submit(values: FormValues) {
    if (readOnly) return

    setTypeError("")
    if (!canManageType(values.type)) {
      setTypeError(t("accessTokens.sheet.unauthorizedType"))
      return
    }

    if (values.type === "Service") {
      setPermissionValidationAttempted(true)
      if (!permissionDraftIsValid(permissions)) {
        focusFirstPermissionError()
        return
      }
    }

    const trimmedName = values.name.trim()
    if (!(await validateName(trimmedName))) return

    const statements =
      values.type === "Service" ? permissionDraftToStatements(permissions) : []

    setSaving(true)
    try {
      if (mode === "edit" && token) {
        await updateAccessToken(token.id, {
          name: trimmedName,
          permissions: statements,
        })
        toast.success(t("accessTokens.operationSucceeded"))
        onSaved()
      } else {
        const created = await createAccessToken({
          name: trimmedName,
          type: values.type,
          permissions: statements,
        })
        toast.success(t("accessTokens.operationSucceeded"))
        onCreated({ name: created.name, token: created.token ?? "" })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      toast.error(
        message.includes("ServiceAccessTokenMustDefinePolicies")
          ? t("accessTokens.sheet.servicePolicyRequired")
          : t("accessTokens.operationFailed")
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving) onOpenChange(nextOpen)
      }}
    >
      <SheetContent
        showCloseButton={false}
        className="gap-0 p-0 data-[side=right]:w-[min(100vw,850px)] data-[side=right]:sm:max-w-[850px]"
      >
        <SheetClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 z-10"
              aria-label={t("accessTokens.sheet.close")}
              disabled={saving}
            />
          }
        >
          <X className="size-4" />
        </SheetClose>

        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">{subtitle}</SheetDescription>
        </SheetHeader>

        <form className="contents" onSubmit={handleSubmit(submit)}>
          <div
            ref={portalContainer}
            data-access-token-sheet
            className="flex-1 space-y-6 overflow-y-auto px-6 py-5"
          >
            <div className="space-y-2">
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="access-token-name">
                    {t("accessTokens.sheet.name")}
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </Label>
                  <Input
                    id="access-token-name"
                    {...nameField}
                    autoFocus={!readOnly}
                    readOnly={readOnly}
                    placeholder={t("accessTokens.sheet.namePlaceholder")}
                    aria-invalid={
                      Boolean(errors.name || nameAvailabilityError) || undefined
                    }
                    onChange={(event) => {
                      nameField.onChange(event)
                      setNameAvailabilityError("")
                      setCheckingName(false)
                    }}
                  />
                  {errors.name?.message || nameAvailabilityError ? (
                    <p className="text-xs text-destructive">
                      {errors.name?.message || nameAvailabilityError}
                    </p>
                  ) : checkingName ? (
                    <p className="text-xs text-muted-foreground">
                      {t("accessTokens.sheet.validating")}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="access-token-type">
                    {t("accessTokens.sheet.type")}
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </Label>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        disabled={mode !== "new" || readOnly}
                        onValueChange={(nextType) => {
                          if (!nextType) return
                          field.onChange(nextType)
                          setTypeError("")
                          if (nextType === "Personal") {
                            setPermissionValidationAttempted(false)
                          }
                        }}
                      >
                        <SelectTrigger
                          id="access-token-type"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectGroup>
                            <SelectItem
                              value="Personal"
                              disabled={mode === "new" && !canManagePersonal}
                            >
                              {t("accessTokens.types.Personal")}
                            </SelectItem>
                            <SelectItem
                              value="Service"
                              disabled={mode === "new" && !canManageService}
                            >
                              {t("accessTokens.types.Service")}
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {typeError ? (
                    <p className="text-xs text-destructive">{typeError}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {type === "Service" ? (
              <div className="border-t pt-6">
                <PermissionsEditor
                  portalContainer={portalContainer}
                  draft={permissions}
                  policies={policies}
                  fineGrainedGranted={fineGrainedGranted}
                  readOnly={readOnly}
                  validationAttempted={permissionValidationAttempted}
                  onChange={setPermissions}
                />
              </div>
            ) : null}
          </div>

          {!readOnly ? (
            <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
              <Button type="submit" disabled={saving || checkingName}>
                {saving
                  ? mode === "new"
                    ? t("accessTokens.sheet.creating")
                    : t("accessTokens.sheet.saving")
                  : mode === "new"
                    ? t("accessTokens.sheet.create")
                    : t("accessTokens.sheet.save")}
              </Button>
            </SheetFooter>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  )
}
