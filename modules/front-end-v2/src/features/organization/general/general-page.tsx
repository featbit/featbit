import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  clearCurrentProjectEnv,
  fetchOrganizations,
  getCurrentOrganization,
  persistCurrentOrganization,
  resolveLang,
} from "@/features/layout/layout-context"
import { OrganizationLayout } from "@/features/organization/components/organization-layout"
import { CreateOrganizationSheet } from "@/features/organization/general/components/create-organization-sheet"
import { IdentitySection } from "@/features/organization/general/components/identity-section"
import { PreferencesSection } from "@/features/organization/general/components/preferences-section"
import { SwitchOrganizationSection } from "@/features/organization/general/components/switch-organization-section"
import {
  createOrganization,
  fetchOrganizationGroups,
  fetchOrganizationPolicies,
  normalizeOrganization,
  updateOrganization,
  type FlagSortedBy,
  type OrganizationGroup,
  type OrganizationDetails,
  type OrganizationPolicy,
} from "@/features/organization/organization-api"

const UI_BROADCAST_CHANNEL = "featbit-ui-broadcast-channel"
const ORG_CHANGED_MESSAGE = "org-changed"

function normalizeOrganizations(organizations: unknown[]) {
  return organizations
    .map((organization) =>
      normalizeOrganization(organization as OrganizationDetails)
    )
    .filter(Boolean) as OrganizationDetails[]
}

function reloadAfterOrganizationChanged(lang: string) {
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(UI_BROADCAST_CHANNEL)
    channel.postMessage(ORG_CHANGED_MESSAGE)
    channel.close()
  }

  window.location.assign(`/${lang}`)
}

export function OrganizationGeneralPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const [organization, setOrganization] = useState<OrganizationDetails | null>(
    () => normalizeOrganization(getCurrentOrganization())
  )
  const [organizations, setOrganizations] = useState<OrganizationDetails[]>(
    () => (organization ? [organization] : [])
  )
  const [name, setName] = useState(organization?.name ?? "")
  const [sortBy, setSortBy] = useState<FlagSortedBy>(
    organization?.settings.flagSortedBy ?? "created_at"
  )
  const [policyId, setPolicyId] = useState(
    organization?.defaultPermissions.policyIds[0] ?? ""
  )
  const [groupId, setGroupId] = useState(
    organization?.defaultPermissions.groupIds[0] ?? ""
  )
  const [policies, setPolicies] = useState<OrganizationPolicy[]>([])
  const [groups, setGroups] = useState<OrganizationGroup[]>([])
  const [policiesLoading, setPoliciesLoading] = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [identitySaving, setIdentitySaving] = useState(false)
  const [sortingSaving, setSortingSaving] = useState(false)
  const [permissionsSaving, setPermissionsSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusVariant, setStatusVariant] = useState<"success" | "error">(
    "success"
  )
  const [statusEventId, setStatusEventId] = useState(0)

  const currentOrganization = useMemo(
    () => organization ?? organizations[0] ?? null,
    [organization, organizations]
  )

  function showStatus(message: string, variant: "success" | "error") {
    setStatusMessage(message)
    setStatusVariant(variant)
    setStatusEventId((current) => current + 1)
  }

  const applyOrganization = useCallback(
    (nextOrganization: OrganizationDetails | null) => {
      setOrganization(nextOrganization)

      if (!nextOrganization) {
        return
      }

      setName(nextOrganization.name)
      setSortBy(nextOrganization.settings.flagSortedBy)
      setPolicyId(nextOrganization.defaultPermissions.policyIds[0] ?? "")
      setGroupId(nextOrganization.defaultPermissions.groupIds[0] ?? "")
    },
    []
  )

  useEffect(() => {
    let cancelled = false

    async function loadOrganizations() {
      try {
        const loadedOrganizations = normalizeOrganizations(
          await fetchOrganizations()
        )
        if (cancelled) {
          return
        }

        setOrganizations(loadedOrganizations)
        const storedOrganization = normalizeOrganization(
          getCurrentOrganization()
        )
        const nextOrganization =
          loadedOrganizations.find(
            (item) => item.id === storedOrganization?.id
          ) ??
          storedOrganization ??
          loadedOrganizations[0] ??
          null

        applyOrganization(nextOrganization)
      } catch {
        if (!cancelled) {
          setOrganizations((current) => current)
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [applyOrganization])

  useEffect(() => {
    let cancelled = false

    async function loadDefaultPermissionOptions() {
      setPoliciesLoading(true)
      setGroupsLoading(true)

      try {
        const [loadedPolicies, loadedGroups] = await Promise.all([
          fetchOrganizationPolicies(),
          fetchOrganizationGroups(),
        ])

        if (cancelled) {
          return
        }

        setPolicies(loadedPolicies.items)
        setGroups(loadedGroups.items)
      } catch {
        if (!cancelled) {
          setPolicies([])
          setGroups([])
        }
      } finally {
        if (!cancelled) {
          setPoliciesLoading(false)
          setGroupsLoading(false)
        }
      }
    }

    void loadDefaultPermissionOptions()

    return () => {
      cancelled = true
    }
  }, [])

  async function saveIdentity() {
    if (!currentOrganization) {
      return
    }

    setIdentitySaving(true)
    try {
      const updatedOrganization = await updateOrganization(
        currentOrganization,
        {
          name: name.trim(),
          settings: currentOrganization.settings,
          defaultPermissions: currentOrganization.defaultPermissions,
        }
      )
      applyOrganization(updatedOrganization)
      setOrganizations((current) =>
        current.map((item) =>
          item.id === updatedOrganization.id ? updatedOrganization : item
        )
      )
      showStatus(t("organization.operationSucceeded"), "success")
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : t("organization.operationFailed"),
        "error"
      )
    } finally {
      setIdentitySaving(false)
    }
  }

  async function saveSorting() {
    if (!currentOrganization) {
      return
    }

    setSortingSaving(true)
    try {
      const updatedOrganization = await updateOrganization(
        currentOrganization,
        {
          name: currentOrganization.name,
          settings: {
            flagSortedBy: sortBy,
          },
          defaultPermissions: currentOrganization.defaultPermissions,
        }
      )
      applyOrganization(updatedOrganization)
      setOrganizations((current) =>
        current.map((item) =>
          item.id === updatedOrganization.id ? updatedOrganization : item
        )
      )
      showStatus(t("organization.operationSucceeded"), "success")
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : t("organization.operationFailed"),
        "error"
      )
    } finally {
      setSortingSaving(false)
    }
  }

  async function savePermissions() {
    if (!currentOrganization) {
      return
    }

    setPermissionsSaving(true)
    try {
      const updatedOrganization = await updateOrganization(
        currentOrganization,
        {
          name: currentOrganization.name,
          settings: currentOrganization.settings,
          defaultPermissions: {
            policyIds: policyId ? [policyId] : [],
            groupIds: groupId ? [groupId] : [],
          },
        }
      )
      applyOrganization(updatedOrganization)
      setOrganizations((current) =>
        current.map((item) =>
          item.id === updatedOrganization.id ? updatedOrganization : item
        )
      )
      showStatus(t("organization.operationSucceeded"), "success")
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : t("organization.operationFailed"),
        "error"
      )
    } finally {
      setPermissionsSaving(false)
    }
  }

  function switchOrganization(organizationId: string) {
    const nextOrganization = organizations.find(
      (item) => item.id === organizationId
    )
    if (!nextOrganization) {
      return
    }

    persistCurrentOrganization(nextOrganization)
    clearCurrentProjectEnv()
    applyOrganization(nextOrganization)

    reloadAfterOrganizationChanged(lang)
  }

  async function submitCreateOrganization(values: {
    name: string
    key: string
  }) {
    setCreating(true)
    try {
      const createdOrganization = await createOrganization({
        name: values.name.trim(),
        key: values.key.trim(),
      })
      setOrganizations((current) => [createdOrganization, ...current])
      applyOrganization(createdOrganization)
      setCreateOpen(false)
      reloadAfterOrganizationChanged(lang)
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : t("organization.operationFailed"),
        "error"
      )
    } finally {
      setCreating(false)
    }
  }

  function copyOrganizationId() {
    if (!currentOrganization) {
      return
    }

    void navigator.clipboard.writeText(currentOrganization.id)
    toast.success(t("organization.copied"))
  }

  function copyOrganizationKey() {
    if (!currentOrganization) {
      return
    }

    void navigator.clipboard.writeText(currentOrganization.key)
    toast.success(t("organization.copied"))
  }

  return (
    <OrganizationLayout
      organization={currentOrganization}
      lang={lang}
      activeTab="general"
      statusMessage={statusMessage}
      statusVariant={statusVariant}
      statusEventId={statusEventId}
    >
      {currentOrganization ? (
        <>
          <IdentitySection
            organization={currentOrganization}
            name={name}
            isSaving={identitySaving}
            onNameChange={setName}
            onCopyId={copyOrganizationId}
            onCopyKey={copyOrganizationKey}
            onSave={saveIdentity}
          />

          <PreferencesSection
            sortBy={sortBy}
            policyId={policyId}
            groupId={groupId}
            policies={policies}
            groups={groups}
            policiesLoading={policiesLoading}
            groupsLoading={groupsLoading}
            isSavingSorting={sortingSaving}
            isSavingPermissions={permissionsSaving}
            onSortByChange={setSortBy}
            onPolicyChange={setPolicyId}
            onGroupChange={setGroupId}
            onSaveSorting={saveSorting}
            onSavePermissions={savePermissions}
          />

          <SwitchOrganizationSection
            organizationId={currentOrganization.id}
            organizations={organizations}
            onOrganizationChange={switchOrganization}
            onCreateOrganization={() => setCreateOpen(true)}
          />

          <CreateOrganizationSheet
            open={createOpen}
            isCreating={creating}
            onOpenChange={setCreateOpen}
            onSubmit={submitCreateOrganization}
          />
        </>
      ) : (
        <div className="py-8">
          <div className="rounded-lg border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {t("organization.empty")}
          </div>
        </div>
      )}
    </OrganizationLayout>
  )
}
