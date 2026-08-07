import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { z } from "zod"
import {
  getCurrentOrganization,
  getCurrentWorkspace,
  resolveLang,
} from "@/features/layout/layout-context"
import { currentUserPoliciesQueryOptions } from "@/features/iam/current-user-policy-query"
import { IdentitySettingsSection } from "@/features/workspace/general/components/identity-settings-section"
import { SsoSettingsSection } from "@/features/workspace/general/components/sso-settings-section"
import { WorkspaceLayout } from "@/features/workspace/components/workspace-layout"
import { canUseAction } from "@/features/iam/current-user-permissions"
import { SkeletonForm } from "@/features/workspace/general/components/workspace-shell"
import {
  isWorkspaceKeyUsed,
  updateWorkspaceIdentity,
  updateWorkspaceOidcSettings,
  workspaceDetailsQueryOptions,
  workspaceQueryKeys,
  type WorkspaceDetails,
} from "@/features/workspace/workspace-api"
import type {
  IdentityFormValues,
  SsoFormValues,
} from "@/features/workspace/general/workspace-types"
import {
  emptySsoValues,
  isSsoLicensed,
} from "@/features/workspace/general/workspace-utils"

export function GeneralPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const queryClient = useQueryClient()
  const [storedWorkspace] = useState<WorkspaceDetails | null>(() =>
    getCurrentWorkspace()
  )
  const workspaceId = storedWorkspace?.id ?? ""
  const workspaceQuery = useQuery({
    ...workspaceDetailsQueryOptions(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const workspace = useMemo<WorkspaceDetails | null>(() => {
    if (!workspaceQuery.data) {
      return storedWorkspace
    }

    return {
      ...workspaceQuery.data,
      license: workspaceQuery.data.license ?? storedWorkspace?.license,
    }
  }, [storedWorkspace, workspaceQuery.data])
  const workspaceRequestError = workspaceQuery.isError
    ? workspaceQuery.error instanceof Error
      ? workspaceQuery.error.message
      : t("workspace.requestFailed")
    : null
  const [identitySaving, setIdentitySaving] = useState(false)
  const [ssoSaving, setSsoSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusVariant, setStatusVariant] = useState<"success" | "error">(
    "success"
  )
  const [statusEventId, setStatusEventId] = useState(0)
  const [secretVisible, setSecretVisible] = useState(false)
  const organizationId = getCurrentOrganization()?.id ?? ""
  const permissionsQuery = useQuery(
    currentUserPoliciesQueryOptions(organizationId)
  )
  const policies = permissionsQuery.data ?? []
  const canUpdateGeneralSettings = canUseAction(
    policies,
    "workspace/*",
    "UpdateWorkspaceGeneralSettings"
  )
  const canUpdateSsoSettings = canUseAction(
    policies,
    "workspace/*",
    "UpdateWorkspaceSSOSettings"
  )
  const ssoLicensed = isSsoLicensed(workspace)

  const requiredMessage = t("workspace.validation.required")
  const urlMessage = t("workspace.validation.url")

  const identitySchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        key: z.string().trim().min(1, requiredMessage),
      }),
    [requiredMessage]
  )

  const ssoSchema = useMemo(
    () =>
      z.object({
        clientId: z.string().trim().min(1, requiredMessage),
        clientSecret: z.string().trim().min(1, requiredMessage),
        tokenEndpoint: z
          .string()
          .trim()
          .min(1, requiredMessage)
          .url(urlMessage),
        clientAuthenticationMethod: z.string().trim().min(1, requiredMessage),
        authorizationEndpoint: z
          .string()
          .trim()
          .min(1, requiredMessage)
          .url(urlMessage),
        scope: z.string().trim().min(1, requiredMessage),
        userEmailClaim: z.string().trim().min(1, requiredMessage),
      }),
    [requiredMessage, urlMessage]
  )

  const identityForm = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      name: workspace?.name ?? "",
      key: workspace?.key ?? "",
    },
    mode: "onChange",
  })

  const ssoForm = useForm<SsoFormValues>({
    resolver: zodResolver(ssoSchema),
    defaultValues: emptySsoValues(workspace),
    mode: "onChange",
  })

  function showStatus(message: string, variant: "success" | "error") {
    setStatusVariant(variant)
    setStatusMessage(message)
    setStatusEventId((current) => current + 1)
  }

  useEffect(() => {
    identityForm.reset({
      name: workspace?.name ?? "",
      key: workspace?.key ?? "",
    })
    ssoForm.reset(emptySsoValues(workspace))
  }, [identityForm, ssoForm, workspace])

  useEffect(() => {
    if (!statusMessage) {
      return
    }

    const timeout = window.setTimeout(() => setStatusMessage(null), 2400)
    return () => window.clearTimeout(timeout)
  }, [statusMessage])

  async function onSaveIdentity(values: IdentityFormValues) {
    if (!canUpdateGeneralSettings || !workspace) {
      return
    }

    setIdentitySaving(true)
    try {
      const trimmedValues = {
        name: values.name.trim(),
        key: values.key.trim(),
      }
      if (trimmedValues.key !== workspace.key) {
        const keyUsed = await isWorkspaceKeyUsed(trimmedValues.key)
        if (keyUsed) {
          identityForm.setError("key", {
            message: t("workspace.validation.keyUsed"),
          })
          return
        }
      }

      const updatedWorkspace = await updateWorkspaceIdentity({
        id: workspace.id,
        ...trimmedValues,
      })
      queryClient.setQueryData(
        workspaceQueryKeys.details(workspace.id),
        updatedWorkspace
      )
      showStatus(t("workspace.operationSucceeded"), "success")
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : t("workspace.requestFailed"),
        "error"
      )
    } finally {
      setIdentitySaving(false)
    }
  }

  async function onSaveSso(values: SsoFormValues) {
    if (!canUpdateSsoSettings || !workspace) {
      return
    }

    setSsoSaving(true)
    try {
      const updatedWorkspace = await updateWorkspaceOidcSettings({
        id: workspace.id,
        ...values,
      })
      queryClient.setQueryData(
        workspaceQueryKeys.details(workspace.id),
        updatedWorkspace
      )
      showStatus(t("workspace.operationSucceeded"), "success")
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : t("workspace.requestFailed"),
        "error"
      )
    } finally {
      setSsoSaving(false)
    }
  }

  return (
    <WorkspaceLayout
      workspace={workspace}
      lang={lang}
      activeTab="general"
      statusMessage={statusMessage ?? workspaceRequestError}
      statusVariant={workspaceQuery.isError ? "error" : statusVariant}
      statusEventId={statusEventId}
    >
      {workspaceQuery.isLoading || permissionsQuery.isLoading ? (
        <div className="py-8">
          <SkeletonForm />
        </div>
      ) : (
        <div>
          <IdentitySettingsSection
            form={identityForm}
            canUpdate={canUpdateGeneralSettings}
            isSaving={identitySaving}
            onSubmit={onSaveIdentity}
          />

          <SsoSettingsSection
            form={ssoForm}
            isLicensed={ssoLicensed}
            canUpdate={canUpdateSsoSettings}
            isSaving={ssoSaving}
            secretVisible={secretVisible}
            setSecretVisible={setSecretVisible}
            onSubmit={onSaveSso}
          />
        </div>
      )}
    </WorkspaceLayout>
  )
}
