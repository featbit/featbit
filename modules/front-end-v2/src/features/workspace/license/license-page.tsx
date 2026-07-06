import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import {
  getCurrentWorkspace,
  resolveLang,
} from "@/features/layout/layout-context"
import { WorkspaceLayout } from "@/features/workspace/components/workspace-layout"
import { EmptyLicenseNotice } from "@/features/workspace/license/components/empty-license-notice"
import { FeatureGrid } from "@/features/workspace/license/components/feature-grid"
import { LicenseAccessSection } from "@/features/workspace/license/components/license-access-section"
import { LicenseSkeleton } from "@/features/workspace/license/components/license-skeleton"
import { SummaryRow } from "@/features/workspace/license/components/summary-row"
import {
  getLicenseStatus,
  parseLicense,
} from "@/features/workspace/license/license-utils"
import {
  fetchWorkspaceDetails,
  updateWorkspaceLicense,
  type WorkspaceDetails,
} from "@/features/workspace/workspace-api"
import { getRuntimeEnv } from "@/lib/env/runtime-env"

const HOSTING_MODE_SAAS = "saas"

export function LicensePage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(() =>
    getCurrentWorkspace()
  )
  const [licenseValue, setLicenseValue] = useState(workspace?.license ?? "")
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusVariant, setStatusVariant] = useState<"success" | "error">(
    "success"
  )
  const [statusEventId, setStatusEventId] = useState(0)
  const isSaas = getRuntimeEnv().hostingMode === HOSTING_MODE_SAAS
  const canUpdateLicense = true

  const license = useMemo(
    () => parseLicense(workspace?.license),
    [workspace?.license]
  )
  const status = getLicenseStatus(license)

  function showStatus(message: string, variant: "success" | "error") {
    setStatusVariant(variant)
    setStatusMessage(message)
    setStatusEventId((current) => current + 1)
  }

  useEffect(() => {
    let cancelled = false

    async function loadWorkspace() {
      setIsLoading(true)
      try {
        const currentWorkspace = getCurrentWorkspace()
        const loadedWorkspace = await fetchWorkspaceDetails()
        if (cancelled) {
          return
        }

        const nextWorkspace = {
          ...loadedWorkspace,
          license: loadedWorkspace.license ?? currentWorkspace?.license,
        }
        setWorkspace(nextWorkspace)
        setLicenseValue(nextWorkspace.license ?? "")
      } catch (error) {
        if (!cancelled) {
          showStatus(
            error instanceof Error
              ? error.message
              : t("workspace.requestFailed"),
            "error"
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadWorkspace()

    return () => {
      cancelled = true
    }
  }, [t])

  async function onUpdateLicense() {
    if (!canUpdateLicense || !licenseValue.trim()) {
      return
    }

    setIsUpdating(true)
    try {
      const updatedWorkspace = await updateWorkspaceLicense(licenseValue.trim())
      setWorkspace(updatedWorkspace)
      setLicenseValue(updatedWorkspace.license ?? licenseValue.trim())
      showStatus(t("workspace.license.updateSucceeded"), "success")
    } catch {
      showStatus(t("workspace.license.invalidLicense"), "error")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <WorkspaceLayout
      workspace={workspace}
      lang={lang}
      activeTab="license"
      statusMessage={statusMessage}
      statusVariant={statusVariant}
      statusEventId={statusEventId}
    >
      {isLoading ? (
        <LicenseSkeleton />
      ) : (
        <div className="pb-8">
          {!isSaas && workspace ? (
            <LicenseAccessSection
              workspace={workspace}
              licenseValue={licenseValue}
              setLicenseValue={setLicenseValue}
              canUpdateLicense={canUpdateLicense}
              isUpdating={isUpdating}
              onCopied={() => {
                showStatus(t("workspace.license.copied"), "success")
              }}
              onUpdateLicense={onUpdateLicense}
            />
          ) : null}

          <section className="pt-7">
            <h2 className="text-lg font-semibold tracking-normal">
              {t("workspace.license.licenseStatus")}
            </h2>
            {license ? (
              <div className="mt-3">
                <SummaryRow
                  isSaas={isSaas}
                  license={license}
                  status={status}
                  lang={lang}
                />
              </div>
            ) : (
              <EmptyLicenseNotice isSaas={isSaas} lang={lang} />
            )}
          </section>

          <FeatureGrid license={license} status={status} />
        </div>
      )}
    </WorkspaceLayout>
  )
}
