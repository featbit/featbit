export type WebhookEventDefinition = {
  group: "featureFlag" | "segment"
  labelKey: string
  value: string
}

export const WEBHOOK_EVENTS: WebhookEventDefinition[] = [
  { group: "featureFlag", labelKey: "created", value: "feature_flag.created" },
  { group: "featureFlag", labelKey: "toggled", value: "feature_flag.toggled" },
  {
    group: "featureFlag",
    labelKey: "archived",
    value: "feature_flag.archived",
  },
  {
    group: "featureFlag",
    labelKey: "restored",
    value: "feature_flag.restored",
  },
  {
    group: "featureFlag",
    labelKey: "variationChanged",
    value: "feature_flag.variation_changed",
  },
  {
    group: "featureFlag",
    labelKey: "offVariationChanged",
    value: "feature_flag.off_variation_changed",
  },
  {
    group: "featureFlag",
    labelKey: "defaultRuleChanged",
    value: "feature_flag.default_rule_changed",
  },
  {
    group: "featureFlag",
    labelKey: "targetUsersChanged",
    value: "feature_flag.target_users_changed",
  },
  {
    group: "featureFlag",
    labelKey: "targetingRulesChanged",
    value: "feature_flag.targeting_rules_changed",
  },
  {
    group: "featureFlag",
    labelKey: "basicInfoUpdated",
    value: "feature_flag.basic_info_updated",
  },
  { group: "featureFlag", labelKey: "deleted", value: "feature_flag.deleted" },
  { group: "segment", labelKey: "created", value: "segment.created" },
  { group: "segment", labelKey: "archived", value: "segment.archived" },
  { group: "segment", labelKey: "restored", value: "segment.restored" },
  {
    group: "segment",
    labelKey: "rulesChanged",
    value: "segment.rules_changed",
  },
  {
    group: "segment",
    labelKey: "targetUsersChanged",
    value: "segment.target_users_changed",
  },
  {
    group: "segment",
    labelKey: "basicInfoUpdated",
    value: "segment.basic_info_updated",
  },
  { group: "segment", labelKey: "deleted", value: "segment.deleted" },
]

export const DEFAULT_TEST_EVENT = "feature_flag.toggled"

export const DEFAULT_PAYLOAD_TEMPLATE = `{
  "event": "{{events}}",
  "operator": "{{operator}}",
  "happenedAt": "{{happenedAt}}",
  "changes": {{json changes}},
  "organization": {
    "id": "{{organization.id}}",
    "name": "{{organization.name}}"
  },
  "project": {
    "id": "{{project.id}}",
    "name": "{{project.name}}"
  },
  "environment": {
    "id": "{{environment.id}}",
    "name": "{{environment.name}}"
  },
  "data": {
    "kind": "{{data.kind}}",
    "object": {
      "id": "{{data.object.id}}",
      "name": "{{data.object.name}}",
      "description": "{{data.object.description}}",
      "tags": {{json data.object.tags}},
{{#eq data.kind "feature flag"}}
      "key": "{{data.object.key}}",
      "variationType": "{{data.object.variationType}}",
      "variations": {{json data.object.variations}},
      "targetUsers": {{json data.object.targetUsers}},
      "rules": {{json data.object.rules}},
      "isEnabled": {{data.object.isEnabled}},
      "disabledVariationId": "{{data.object.disabledVariationId}}",
      "fallthrough": {{json data.object.fallthrough}},
      "exptIncludeAllTargets": {{data.object.exptIncludeAllTargets}},
{{/eq}}
{{#eq data.kind "segment"}}
      "included": {{json data.object.included}},
      "excluded": {{json data.object.excluded}},
      "rules": {{json data.object.rules}},
      "flagReferences": {{json data.object.flagReferences}},
{{/eq}}
      "isArchived": {{data.object.isArchived}}
    }
  }
}`
