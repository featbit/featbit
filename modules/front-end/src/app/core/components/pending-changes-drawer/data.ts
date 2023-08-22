export const INSTRUCTIONS = [
  {
    "kind": "SetRules",
    "value": [
      {
        "id": "87b3ce72-f871-4291-a87d-ee0494ebe855",
        "name": "rule1233",
        "dispatchKey": "rule1",
        "includedInExpt": true,
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
        "variations": [
          {
            "id": "variation1",
            "rollout": [
              0,
              0.5
            ],
            "exptRollout": 0
          },
          {
            "id": "variation1",
            "rollout": [
              0.5,
              1
            ],
            "exptRollout": 0
          }
        ]
      },
      {
        "id": "7dd0b0ab-5b13-4948-9cff-fad39b2272d7",
        "name": "468",
        "dispatchKey": "rule1",
        "includedInExpt": true,
        "conditions": [
          {
            "id": "0.378575",
            "property": "keyId",
            "op": "IsOneOf",
            "value": "[\"user1\",\"user2\"]"
          },
          {
            "id": "xxxxxx",
            "property": "name",
            "op": "Equal",
            "value": "abc"
          }
        ],
        "variations": [
          {
            "id": "variation1",
            "rollout": [
              0,
              0.5
            ],
            "exptRollout": 0
          },
          {
            "id": "variation1",
            "rollout": [
              0.5,
              1
            ],
            "exptRollout": 0
          }
        ]
      }
    ]
  },
  {
    "kind": "RemoveRule",
    "value": "87b3ce72-f871-4291-a87d-ee0494ebe850"
  },
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
