import {
  resourceDisplayName,
  type ResourceType,
} from "@/features/iam/policies/details/permission-model"
import type { TFunction } from "i18next"
import type { MemberPermission } from "../permissions-api"
import {
  isWildcardResource,
  permissionActionFallback,
} from "../permissions-model"

export function PermissionStatementDetails({
  id,
  permission,
  t,
}: {
  id: string
  permission: MemberPermission
  t: TFunction
}) {
  const resourceType = resourceTypeLabel(permission.resourceType, t)
  const resources = permission.resources.map((resource) => ({
    label: isWildcardResource(resource)
      ? allResourcesLabel(permission.resourceType, t)
      : resourceDisplayName(resource),
    value: resource,
  }))
  const actions = permission.actions.map((action) => ({
    label:
      action === "*"
        ? t("iam.team.details.allActions")
        : actionLabel(action, t),
    value: action,
  }))

  return (
    <div id={id} className="grid grid-cols-[5%_39%_56%] border-t py-4">
      <div aria-hidden="true" />
      <DetailGroup
        title={t("iam.team.details.resources")}
        context={resourceType}
      >
        <DetailItems
          items={resources}
          emptyLabel={t(
            "iam.policies.details.permissionsEditor.noResourcesSelected"
          )}
          columns={2}
        />
      </DetailGroup>
      <DetailGroup title={t("iam.team.details.actions")}>
        <DetailItems
          items={actions}
          emptyLabel={t(
            "iam.policies.details.permissionsEditor.noActionsSelected"
          )}
          columns={2}
        />
      </DetailGroup>
    </div>
  )
}

function DetailGroup({
  title,
  context,
  children,
}: {
  title: string
  context?: string
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 px-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {context ? (
          <span className="text-xs text-muted-foreground">{context}</span>
        ) : null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function DetailItems({
  items,
  emptyLabel,
  columns = 1,
}: {
  items: { label: string; value: string }[]
  emptyLabel: string
  columns?: 1 | 2
}) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div
      className={
        columns === 2 ? "grid grid-cols-2 gap-x-6 gap-y-2" : "grid gap-2"
      }
    >
      {items.map((item, index) => (
        <div key={`${item.value}:${index}`} className="min-w-0">
          <p className="text-sm font-medium [overflow-wrap:anywhere]">
            {item.label}
          </p>
          <code className="block bg-transparent font-mono text-xs leading-5 [overflow-wrap:anywhere] whitespace-normal text-muted-foreground">
            {item.value}
          </code>
        </div>
      ))}
    </div>
  )
}

function resourceTypeLabel(resourceType: ResourceType, t: TFunction) {
  return t(
    `iam.policies.details.permissionsEditor.resourceTypes.${resourceType}`,
    { defaultValue: resourceType }
  )
}

function allResourcesLabel(resourceType: ResourceType, t: TFunction) {
  if (resourceType === "*") {
    return t("iam.policies.details.permissionsEditor.allResources")
  }

  const type = t(
    `iam.policies.details.permissionsEditor.resourceTypePlurals.${resourceType}`,
    { defaultValue: resourceTypeLabel(resourceType, t).toLocaleLowerCase() }
  )

  return t("iam.team.details.allResourcesOfType", { type })
}

function actionLabel(action: string, t: TFunction) {
  return t(`iam.policies.details.permissionsEditor.actionLabels.${action}`, {
    defaultValue: permissionActionFallback(action),
  })
}
