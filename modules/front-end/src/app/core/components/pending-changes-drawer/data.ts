export const INSTRUCTIONS = [
  {
    "kind": "TurnFlagOn",
    "value": ""
  },
  {
    "kind": "TurnFlagOff",
    "value": ""
  },
  {
    "kind": "ArchiveFlag",
    "value": ""
  },
  {
    "kind": "RestoreFlag",
    "value": ""
  },
  {
    "kind": "UpdateName",
    "value": "abc"
  },
  {
    "kind": "UpdateDescription",
    "value": "abc description"
  },
  {
    "kind": "RemoveTags",
    "value": [
      "aaa"
    ]
  },
  {
    "kind": "AddTags",
    "value": [
      "123",
      "456"
    ]
  },
  {
    "kind": "UpdateVariationType",
    "value": "string"
  },
  {
    "kind": "RemoveVariation",
    "value": "e834669c-9f1f-4890-b014-9e86226cdbc8"
  },
  {
    "kind": "AddVariation",
    "value": {
      "id": null,
      "name": "aaaaa",
      "value": "hello babdy al;wjefioa awe"
    }
  },
  {
    "kind": "UpdateVariation",
    "value": {
      "id": "e9a52fe4-e7c5-4da2-be6a-cf0321681008",
      "name": "Updated",
      "value": "false"
    }
  },
  {
    "kind": "UpdateDisabledVariation",
    "value": "e834669c-9f1f-4890-b014-9e86226cdbc8"
  },
  {
    "kind": "UpdateDefaultVariation",
    "value": {
      "dispatchKey": "name",
      "includedInExpt": false,
      "variations": [
        {
          "id": null,
          "rollout": [
            0,
            1
          ],
          "exptRollout": 0
        }
      ]
    }
  },
  {
    "kind": "RemoveTargetUsers",
    "value": {
      "keyIds": [
        "user2",
        "user1"
      ],
      "variationId": "e9a52fe4-e7c5-4da2-be6a-cf0321681008"
    }
  },
  {
    "kind": "AddTargetUsers",
    "value": {
      "keyIds": [
        "user3"
      ],
      "variationId": "e9a52fe4-e7c5-4da2-be6a-cf0321681008"
    }
  },
  {
    "kind": "AddRule",
    "value": {
      "id": "7dd0b0ab-5b13-4948-9cff-fad39b2272d6",
      "name": "rule1233",
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
  },
  {
    "kind": "UpdateRuleName",
    "value": {
      "name": "rule1233",
      "ruleId": "87b3ce72-f871-4291-a87d-ee0494ebe850"
    }
  },
  {
    "kind": "UpdateRuleDispatchKey",
    "value": {
      "dispatchKey": "rule1",
      "ruleId": "87b3ce72-f871-4291-a87d-ee0494ebe850"
    }
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
