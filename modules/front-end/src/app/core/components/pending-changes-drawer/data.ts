export const INSTRUCTIONS = [
  {
    "kind": "RemoveRuleConditions",
    "value": {
      "conditionIds": [
        "030595a9-fbf3-458e-b150-37bb27086e32",
        "8125ee7c-2fa5-4aec-9865-7d08e391b09c"
      ],
      "ruleId": "87b3ce72-f871-4291-a87d-ee0494ebe850"
    }
  },
  {
    "kind": "AddRuleConditions",
    "value": {
      "conditions": [
        {
          "id": "0.0125179",
          "property": "name",
          "op": "IsOneOf",
          "value": "[\"ooo\",\"user1\",\"user2\"]"
        },
        {
          "id": "xxxxxxy",
          "property": "name",
          "op": "Equal",
          "value": "abc"
        },
        {
          "id": "0.646952",
          "property": "keyId",
          "op": "IsFalse",
          "value": "IsFalse"
        }
      ],
      "ruleId": "87b3ce72-f871-4291-a87d-ee0494ebe850"
    }
  },
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
      "ruleId": "87b3ce72-f871-4291-a87d-ee0494ebe850"
    }
  }
]
