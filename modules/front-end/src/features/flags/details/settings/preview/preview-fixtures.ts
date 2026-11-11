import type { FeatureFlag } from "../../../flags-types"
import type { CustomField } from "../../../custom-fields/custom-fields-model"
import {
  documentationRecordKey,
  readCustomFieldsProject,
  writeCustomFieldsProject,
} from "../../../custom-fields/custom-fields-storage"

export const previewProjectId = "flag-settings-preview-project"
export const previewEnvId = "flag-settings-preview-dev"
export const previewEnvironments = [
  { id: previewEnvId, key: "dev", name: "Dev" },
  { id: "flag-settings-preview-staging", key: "staging", name: "Staging" },
  {
    id: "flag-settings-preview-production",
    key: "production",
    name: "Production",
  },
]
export const previewFlagKey = "rainy-day-rescue"
export const previewUser = {
  id: "flag-settings-preview-user",
  name: "Design Preview",
  email: "preview@featbit.local",
}
export const previewFields: CustomField[] = [
  {
    id: "date-expiry",
    key: "date-expiry",
    name: "Date expiry",
    required: false,
    controls: [
      {
        id: "review-at",
        key: "review-at",
        label: "Review date and time",
        type: "datetime",
      },
      {
        id: "exit-criteria",
        key: "exit-criteria",
        label: "Exit criteria",
        type: "markdown",
      },
    ],
  },
  {
    id: "default-safe",
    key: "default-safe",
    name: "Default safe",
    required: true,
    controls: [
      {
        id: "behavior",
        key: "behavior",
        label: "Expected fallback behavior",
        type: "markdown",
      },
    ],
  },
]
export const previewFlag: FeatureFlag = {
  id: "rainy-day-rescue-id",
  key: previewFlagKey,
  name: "Rainy-day rescue",
  variationType: "string",
  description:
    "## Purpose\nOffer a rainy-day rescue promotion when bad weather affects the customer journey.\n\n## Operating procedure\n- Enable the offer in the storefront and promotions service together.\n- Monitor redemption errors and promotion spend during the rollout.\n- Turn this flag off if redemption errors exceed **1%** for 5 minutes.\n\n## Cleanup\nRemove the flag after the campaign finishes and the standard offer is restored.",
  tags: ["promotion"],
  isEnabled: true,
  isArchived: false,
  insightsEnabled: true,
  envId: previewEnvId,
  revision: "preview-revision-1",
  createdAt: "2026-11-01T08:00:00.000Z",
  updatedAt: "2026-11-05T08:00:00.000Z",
  creator: previewUser,
  lastChange: { operator: previewUser, happenedAt: "2026-11-05T08:00:00.000Z" },
  variations: [
    { id: "offer", name: "Rescue offer", value: "rescue-offer" },
    { id: "standard", name: "Standard offer", value: "standard-offer" },
  ],
  disabledVariationId: "standard",
  targetUsers: [],
  rules: [],
  fallthrough: {
    variations: [{ id: "offer", rollout: [0, 1] }],
    dispatchKey: null,
  },
  serves: {
    disabledVariation: "standard-offer",
    enabledVariations: ["rescue-offer"],
  },
}

export function currentPreviewFlag(envId = previewEnvId): FeatureFlag {
  const record =
    readCustomFieldsProject(previewProjectId).records[
      documentationRecordKey(envId, previewFlagKey)
    ]
  return {
    ...previewFlag,
    ...JSON.parse(
      sessionStorage.getItem(`featbit:flag-preview-runtime:${envId}`) ?? "{}"
    ),
    ...record?.general,
    id: `${envId}-rainy-day-rescue`,
    envId,
  }
}

export function initializePreviewFixtures() {
  const state = readCustomFieldsProject(previewProjectId)
  if (state.configured) return
  // Sample project configuration; the renderer has no built-in operational fields.
  state.configured = true
  state.fields = structuredClone(previewFields)
  for (const environment of previewEnvironments) {
    const key = documentationRecordKey(environment.id, previewFlagKey)
    const staging = environment.key === "staging"
    const production = environment.key === "production"
    state.records[key] = {
      general: state.records[key]?.general ?? {
        name: production ? "Rainy-day rescue - live" : previewFlag.name,
        description: staging
          ? "## Staging checks\nVerify the promotion with test accounts before production rollout."
          : previewFlag.description!,
        tags: production ? ["promotion", "production"] : previewFlag.tags,
      },
      customFields: {
        "date-expiry": {
          "review-at": staging ? "" : "2026-12-15T09:00:00.000Z",
          "exit-criteria": staging
            ? "Remove test overrides after production verification."
            : "Remove this flag after the campaign ends and the standard offer is restored.",
        },
        "default-safe": {
          behavior: staging
            ? "Show the **standard offer** to test accounts when the flag cannot be resolved."
            : "Keep the **standard offer** visible. Do not grant a promotion if the flag cannot be resolved at runtime.\n\nFlag behavior is configured in Targeting. The application code uses the SDK to retrieve configuration and implements evaluation and fallback handling. This note does not change configuration or synchronize with running SDKs.",
        },
      },
    }
  }
  writeCustomFieldsProject(previewProjectId, state)
}
