import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import {
  AccountDetailsSection,
  type AccountDetailsValues,
} from "@/features/profile/components/account-details-section"
import {
  PasswordSection,
  type PasswordValues,
} from "@/features/profile/components/password-section"
import {
  getStoredProfile,
  resetPassword,
  updateProfile,
  type UserProfile,
} from "@/features/profile/profile-api"

function ProfileStatusToast({
  message,
  variant,
  eventId,
}: {
  message: string | null
  variant: "success" | "error" | "warning"
  eventId?: number
}) {
  useEffect(() => {
    if (!message) {
      return
    }

    const options = { id: "profile-status", duration: 2400 }
    if (variant === "error") {
      toast.error(message, options)
      return
    }

    if (variant === "warning") {
      toast.warning(message, options)
      return
    }

    toast.success(message, options)
  }, [eventId, message, variant])

  return null
}

export function ProfilePage() {
  const { t } = useTranslation()
  const [profile, setProfile] = useState<UserProfile>(() => getStoredProfile())
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusVariant, setStatusVariant] = useState<
    "success" | "error" | "warning"
  >("success")
  const [statusEventId, setStatusEventId] = useState(0)

  const requiredMessage = t("profile.validation.required")
  const emailMessage = t("profile.validation.email")
  const passwordLengthMessage = t("profile.validation.passwordLength")
  const passwordMismatchMessage = t("profile.validation.passwordMismatch")

  const accountDetailsSchema = useMemo(
    () =>
      z.object({
        name: z.string(),
        email: z.string().trim().min(1, requiredMessage).email(emailMessage),
      }),
    [emailMessage, requiredMessage]
  )

  const passwordSchema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, requiredMessage),
          newPassword: z
            .string()
            .min(1, requiredMessage)
            .min(6, passwordLengthMessage),
          confirmPassword: z.string().min(1, requiredMessage),
        })
        .refine((values) => values.newPassword === values.confirmPassword, {
          path: ["confirmPassword"],
          message: passwordMismatchMessage,
        }),
    [passwordLengthMessage, passwordMismatchMessage, requiredMessage]
  )

  const accountDetailsForm = useForm<AccountDetailsValues>({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: {
      name: profile.name ?? "",
      email: profile.email ?? "",
    },
    mode: "onChange",
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onChange",
  })

  const isLocalUser = (profile.origin ?? "Local") === "Local"

  function showStatus(
    message: string,
    variant: "success" | "error" | "warning"
  ) {
    setStatusMessage(message)
    setStatusVariant(variant)
    setStatusEventId((current) => current + 1)
  }

  useEffect(() => {
    accountDetailsForm.reset({
      name: profile.name ?? "",
      email: profile.email ?? "",
    })
  }, [accountDetailsForm, profile])

  async function saveProfile(values: AccountDetailsValues) {
    setProfileSaving(true)
    try {
      const updatedProfile = await updateProfile({
        name: values.name.trim(),
        email: values.email.trim(),
      })
      setProfile(updatedProfile)
      showStatus(t("profile.accountDetails.updated"), "success")
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : t("profile.operationFailed"),
        "error"
      )
    } finally {
      setProfileSaving(false)
    }
  }

  async function submitResetPassword(values: PasswordValues) {
    setPasswordSaving(true)
    try {
      const result = await resetPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })

      if (result.success) {
        passwordForm.reset()
        showStatus(t("profile.password.resetSuccess"), "success")
      } else {
        showStatus(
          t("profile.password.resetFailed", {
            reason: result.reason ?? t("profile.password.unknownReason"),
          }),
          "warning"
        )
      }
    } catch {
      showStatus(t("profile.operationFailedShort"), "error")
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
      <ProfileStatusToast
        message={statusMessage}
        variant={statusVariant}
        eventId={statusEventId}
      />
      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("profile.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("profile.subtitle")}
        </p>
      </header>

      <AccountDetailsSection
        form={accountDetailsForm}
        origin={profile.origin}
        isSaving={profileSaving}
        onSubmit={saveProfile}
      />

      {isLocalUser ? (
        <PasswordSection
          form={passwordForm}
          isSaving={passwordSaving}
          onSubmit={submitResetPassword}
        />
      ) : null}
    </div>
  )
}
