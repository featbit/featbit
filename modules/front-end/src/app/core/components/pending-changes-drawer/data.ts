export const INSTRUCTIONS = [
  {
    "kind": "UpdateRuleCondition",
    "value": {
      "condition": {
        "id": "1de4137d-4877-457b-a005-a4f08f6c1d20",
        "property": "keyId",
        "op": "IsOneOf",
        "value": "[\"abc\",\"def\"]"
      },
      "ruleId": "df830874-2fc2-4809-a419-f5dae9112281"
    }
  },
  {
    "kind": "UpdateRuleCondition",
    "value": {
      "condition": {
        "id": "7d9b1c05-56d4-4d84-96fd-1fa38662e24d",
        "property": "name",
        "op": "IsFalse",
        "value": "IsFalse"
      },
      "ruleId": "df830874-2fc2-4809-a419-f5dae9112281"
    }
  },
  {
    "kind": "AddValuesToRuleCondition",
    "value": {
      "conditionId": "1de4137d-4877-457b-a005-a4f08f6c1d20",
      "values": [
        "ghi",
        "jkl"
      ],
      "ruleId": "df830874-2fc2-4809-a419-f5dae9112281"
    }
  },
  {
    "kind": "RemoveValuesFromRuleCondition",
    "value": {
      "conditionId": "5a657d61-8b31-429d-aaf1-ef79cdb6d484",
      "values": [
        "456"
      ],
      "ruleId": "df830874-2fc2-4809-a419-f5dae9112281"
    }
  },
  {
    "kind": "UpdateRuleVariationOrRollouts",
    "value": {
      "rolloutVariations": [
        {
          "id": "variation1",
          "rollout": [
            0,
            0.5
          ]
        },
        {
          "id": "variation1",
          "rollout": [
            0.5,
            1
          ]
        }
      ],
      "ruleId": "df830874-2fc2-4809-a419-f5dae9112281"
    }
  }
]
