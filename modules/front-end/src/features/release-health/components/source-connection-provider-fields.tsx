import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { LockKeyhole, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import type {
  MetricSourceAuthenticationType,
  MetricSourceConnection,
} from "../release-health-types"
import {
  isValidHttpUrl,
  type SourceConnectionConfigurationDraft,
  type SourceConnectionProviderType,
} from "./source-connection-provider-types"

type SourceConnectionProviderFieldsProps = {
  provider: SourceConnectionProviderType
  draft: SourceConnectionConfigurationDraft
  connection?: MetricSourceConnection
  onChange: (next: Partial<SourceConnectionConfigurationDraft>) => void
}

export function SourceConnectionProviderFields({
  provider,
  draft,
  connection,
  onChange,
}: SourceConnectionProviderFieldsProps) {
  if (provider === "datadog") {
    return <DatadogFields draft={draft} onChange={onChange} />
  }
  if (provider === "new-relic") {
    return <NewRelicFields draft={draft} onChange={onChange} />
  }
  if (provider === "azure-data-explorer") {
    return <AzureDataExplorerFields draft={draft} onChange={onChange} />
  }
  return (
    <PrometheusFields
      draft={draft}
      connection={connection}
      onChange={onChange}
    />
  )
}

function PrometheusFields({
  draft,
  connection,
  onChange,
}: Omit<SourceConnectionProviderFieldsProps, "provider">) {
  const { t } = useTranslation()
  const canKeepConfiguredSecret = Boolean(
    connection &&
    connection.authentication.secretState === "configured" &&
    draft.authentication === connection.authentication.type
  )

  function changeAuthentication(value: MetricSourceAuthenticationType) {
    onChange({
      authentication: value,
      prometheusBearerToken: "",
      prometheusBasicPassword: "",
      prometheusBasicUsername:
        value === "basic" && connection?.authentication.type === "basic"
          ? connection.authentication.username
          : "",
    })
  }

  return (
    <div className="space-y-5">
      <Field
        label={t("releaseHealth.connections.endpoint")}
        htmlFor="source-connection-endpoint"
      >
        <Input
          id="source-connection-endpoint"
          type="url"
          value={draft.endpoint}
          aria-invalid={
            Boolean(draft.endpoint) && !isValidHttpUrl(draft.endpoint)
          }
          onChange={(event) => onChange({ endpoint: event.target.value })}
          placeholder="https://prometheus.example.com"
        />
        <FieldHelp>
          {t("releaseHealth.connections.editor.endpointHelp")}
        </FieldHelp>
      </Field>

      <Field
        label={t("releaseHealth.connections.authentication")}
        htmlFor="source-connection-authentication"
      >
        <Select
          value={draft.authentication}
          onValueChange={(value) =>
            value &&
            changeAuthentication(value as MetricSourceAuthenticationType)
          }
        >
          <SelectTrigger
            id="source-connection-authentication"
            className="w-full"
          >
            <SelectValue>
              {t(`releaseHealth.connections.auth.${draft.authentication}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(["bearer_token", "basic", "none"] as const).map(
                (authentication) => (
                  <SelectItem key={authentication} value={authentication}>
                    {t(`releaseHealth.connections.auth.${authentication}`)}
                  </SelectItem>
                )
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldHelp>{t("releaseHealth.connections.editor.authHelp")}</FieldHelp>
      </Field>

      {canKeepConfiguredSecret ? <ConfiguredCredentialState /> : null}

      {draft.authentication === "bearer_token" ? (
        <Field
          label={t("releaseHealth.connections.editor.token")}
          htmlFor="source-connection-bearer-token"
        >
          <Input
            id="source-connection-bearer-token"
            type="password"
            autoComplete="new-password"
            value={draft.prometheusBearerToken}
            required={!canKeepConfiguredSecret}
            placeholder={t(
              canKeepConfiguredSecret
                ? "releaseHealth.connections.editor.replaceToken"
                : "releaseHealth.connections.editor.tokenPlaceholder"
            )}
            onChange={(event) =>
              onChange({ prometheusBearerToken: event.target.value })
            }
          />
          <FieldHelp>
            {t("releaseHealth.connections.editor.tokenHelp")}
          </FieldHelp>
        </Field>
      ) : null}

      {draft.authentication === "basic" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("releaseHealth.connections.editor.username")}
            htmlFor="source-connection-basic-username"
          >
            <Input
              id="source-connection-basic-username"
              value={draft.prometheusBasicUsername}
              autoComplete="username"
              required
              placeholder="metrics-reader"
              onChange={(event) =>
                onChange({ prometheusBasicUsername: event.target.value })
              }
            />
            <FieldHelp>
              {t("releaseHealth.connections.editor.usernameHelp")}
            </FieldHelp>
          </Field>
          <Field
            label={t("releaseHealth.connections.editor.password")}
            htmlFor="source-connection-basic-password"
          >
            <Input
              id="source-connection-basic-password"
              type="password"
              autoComplete="new-password"
              value={draft.prometheusBasicPassword}
              required={!canKeepConfiguredSecret}
              placeholder={t(
                canKeepConfiguredSecret
                  ? "releaseHealth.connections.editor.replacePassword"
                  : "releaseHealth.connections.editor.passwordPlaceholder"
              )}
              onChange={(event) =>
                onChange({ prometheusBasicPassword: event.target.value })
              }
            />
            <FieldHelp>
              {t("releaseHealth.connections.editor.passwordHelp")}
            </FieldHelp>
          </Field>
        </div>
      ) : null}

      {draft.authentication === "none" ? (
        <NoAuthenticationNotice />
      ) : (
        <CredentialProtectionNotice />
      )}
    </div>
  )
}

function ConfiguredCredentialState() {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">
            {t("releaseHealth.connections.editor.configuredTitle")}
          </p>
          <Badge variant="secondary">
            {t("releaseHealth.connections.editor.configured")}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("releaseHealth.connections.editor.configuredHelp")}
        </p>
      </div>
    </div>
  )
}

function CredentialProtectionNotice() {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/20 p-3">
      <LockKeyhole className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-sm font-medium">
          {t("releaseHealth.connections.editor.protectedTitle")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("releaseHealth.connections.editor.protectedHelp")}
        </p>
      </div>
    </div>
  )
}

function NoAuthenticationNotice() {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/20 p-3">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-sm font-medium">
          {t("releaseHealth.connections.editor.noAuthenticationTitle")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("releaseHealth.connections.editor.noAuthenticationHelp")}
        </p>
      </div>
    </div>
  )
}

function DatadogFields({
  draft,
  onChange,
}: Pick<SourceConnectionProviderFieldsProps, "draft" | "onChange">) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <Field
        label={t("releaseHealth.connections.editor.datadog.site")}
        htmlFor="source-connection-datadog-site"
      >
        <Select
          value={draft.datadogSite}
          onValueChange={(value) =>
            value &&
            onChange({
              datadogSite:
                value as SourceConnectionConfigurationDraft["datadogSite"],
            })
          }
        >
          <SelectTrigger id="source-connection-datadog-site" className="w-full">
            <SelectValue>
              {draft.datadogSite === "us1"
                ? "US1 · datadoghq.com"
                : draft.datadogSite === "eu1"
                  ? "EU1 · datadoghq.eu"
                  : t("releaseHealth.connections.editor.datadog.customSite")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="us1">US1 · datadoghq.com</SelectItem>
              <SelectItem value="eu1">EU1 · datadoghq.eu</SelectItem>
              <SelectItem value="custom">
                {t("releaseHealth.connections.editor.datadog.customSite")}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldHelp>
          {t("releaseHealth.connections.editor.datadog.siteHelp")}
        </FieldHelp>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("releaseHealth.connections.editor.datadog.apiKey")}
          htmlFor="source-connection-datadog-api-key"
        >
          <Input
            id="source-connection-datadog-api-key"
            type="password"
            autoComplete="new-password"
            value={draft.datadogApiKey}
            onChange={(event) =>
              onChange({ datadogApiKey: event.target.value })
            }
            placeholder={t("releaseHealth.connections.editor.writeOnlySecret")}
          />
        </Field>
        <Field
          label={t("releaseHealth.connections.editor.datadog.applicationKey")}
          htmlFor="source-connection-datadog-application-key"
        >
          <Input
            id="source-connection-datadog-application-key"
            type="password"
            autoComplete="new-password"
            value={draft.datadogApplicationKey}
            onChange={(event) =>
              onChange({ datadogApplicationKey: event.target.value })
            }
            placeholder={t("releaseHealth.connections.editor.writeOnlySecret")}
          />
        </Field>
      </div>
      <FieldHelp>{t("releaseHealth.connections.editor.secretHelp")}</FieldHelp>
    </div>
  )
}

function NewRelicFields({
  draft,
  onChange,
}: Pick<SourceConnectionProviderFieldsProps, "draft" | "onChange">) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("releaseHealth.connections.editor.newRelic.region")}
          htmlFor="source-connection-new-relic-region"
        >
          <Select
            value={draft.newRelicRegion}
            onValueChange={(value) =>
              value &&
              onChange({
                newRelicRegion:
                  value as SourceConnectionConfigurationDraft["newRelicRegion"],
              })
            }
          >
            <SelectTrigger
              id="source-connection-new-relic-region"
              className="w-full"
            >
              <SelectValue>
                {draft.newRelicRegion === "us"
                  ? "United States"
                  : "European Union"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="us">United States</SelectItem>
                <SelectItem value="eu">European Union</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={t("releaseHealth.connections.editor.newRelic.accountId")}
          htmlFor="source-connection-new-relic-account-id"
        >
          <Input
            id="source-connection-new-relic-account-id"
            inputMode="numeric"
            value={draft.newRelicAccountId}
            onChange={(event) =>
              onChange({ newRelicAccountId: event.target.value })
            }
            placeholder="1234567"
          />
        </Field>
      </div>

      <Field
        label={t("releaseHealth.connections.editor.newRelic.userApiKey")}
        htmlFor="source-connection-new-relic-api-key"
      >
        <Input
          id="source-connection-new-relic-api-key"
          type="password"
          autoComplete="new-password"
          value={draft.newRelicApiKey}
          onChange={(event) => onChange({ newRelicApiKey: event.target.value })}
          placeholder={t("releaseHealth.connections.editor.writeOnlySecret")}
        />
        <FieldHelp>
          {t("releaseHealth.connections.editor.newRelic.apiKeyHelp")}
        </FieldHelp>
      </Field>
    </div>
  )
}

function AzureDataExplorerFields({
  draft,
  onChange,
}: Pick<SourceConnectionProviderFieldsProps, "draft" | "onChange">) {
  const { t } = useTranslation()
  const usesApplication = draft.azureAuthentication === "entra-application"
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("releaseHealth.connections.editor.azure.clusterUri")}
          htmlFor="source-connection-azure-cluster-uri"
        >
          <Input
            id="source-connection-azure-cluster-uri"
            type="url"
            value={draft.azureClusterUri}
            onChange={(event) =>
              onChange({ azureClusterUri: event.target.value })
            }
            placeholder="https://cluster.region.kusto.windows.net"
          />
        </Field>
        <Field
          label={t("releaseHealth.connections.editor.azure.database")}
          htmlFor="source-connection-azure-database"
        >
          <Input
            id="source-connection-azure-database"
            value={draft.azureDatabase}
            onChange={(event) =>
              onChange({ azureDatabase: event.target.value })
            }
            placeholder="Telemetry"
          />
        </Field>
      </div>

      <Field
        label={t("releaseHealth.connections.authentication")}
        htmlFor="source-connection-azure-authentication"
      >
        <Select
          value={draft.azureAuthentication}
          onValueChange={(value) =>
            value &&
            onChange({
              azureAuthentication:
                value as SourceConnectionConfigurationDraft["azureAuthentication"],
            })
          }
        >
          <SelectTrigger
            id="source-connection-azure-authentication"
            className="w-full"
          >
            <SelectValue>
              {t(
                draft.azureAuthentication === "entra-application"
                  ? "releaseHealth.connections.editor.azure.entraApplication"
                  : "releaseHealth.connections.editor.azure.managedIdentity"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="entra-application">
                {t("releaseHealth.connections.editor.azure.entraApplication")}
              </SelectItem>
              <SelectItem value="managed-identity">
                {t("releaseHealth.connections.editor.azure.managedIdentity")}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {usesApplication ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("releaseHealth.connections.editor.azure.tenantId")}
              htmlFor="source-connection-azure-tenant-id"
            >
              <Input
                id="source-connection-azure-tenant-id"
                value={draft.azureTenantId}
                onChange={(event) =>
                  onChange({ azureTenantId: event.target.value })
                }
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </Field>
            <Field
              label={t("releaseHealth.connections.editor.azure.clientId")}
              htmlFor="source-connection-azure-client-id"
            >
              <Input
                id="source-connection-azure-client-id"
                value={draft.azureClientId}
                onChange={(event) =>
                  onChange({ azureClientId: event.target.value })
                }
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </Field>
          </div>
          <Field
            label={t("releaseHealth.connections.editor.azure.clientSecret")}
            htmlFor="source-connection-azure-client-secret"
          >
            <Input
              id="source-connection-azure-client-secret"
              type="password"
              autoComplete="new-password"
              value={draft.azureClientSecret}
              onChange={(event) =>
                onChange({ azureClientSecret: event.target.value })
              }
              placeholder={t(
                "releaseHealth.connections.editor.writeOnlySecret"
              )}
            />
          </Field>
        </>
      ) : (
        <FieldHelp>
          {t("releaseHealth.connections.editor.azure.managedIdentityHelp")}
        </FieldHelp>
      )}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}
