export const INSTRUCTIONS = [
  {
    "kind": "UpdateDisabledVariation",
    "value": "e9a52fe4-e7c5-4da2-be6a-cf0321681008"
  },
  {
    "kind": "ArchiveFlag",
    "value": ""
  },
  {
    "kind": "UpdateName",
    "value": ""
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
    "kind": "AddVariation",
    "value": {
      "id": null,
      "name": "aaaaa",
      "value": "true"
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
    "kind": "UpdateDefaultRuleVariationOrRollouts",
    "value": {
      "rolloutVariations": [
        {
          "id": "e834669c-9f1f-4890-b014-9e86226cdbc8",
          "rollout": [
            0,
            0.98
          ],
          "exptRollout": 1
        },
        {
          "id": "e9a52fe4-e7c5-4da2-be6a-cf0321681008",
          "rollout": [
            0.98,
            1
          ],
          "exptRollout": 1
        }
      ]
    }
  },
  {
    "kind": "UpdateDefaultRuleDispatchKey",
    "value": "ddd"
  },
  {
    "kind": "RemoveTargetUsers",
    "value": {
      "keyIds": [
        "user3"
      ],
      "variationId": "e834669c-9f1f-4890-b014-9e86226cdbc8"
    }
  },
  {
    "kind": "AddRule",
    "value": {
      "id": "7dd0b0ab-5b13-4948-9cff-fad39b2272d7",
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
    "kind": "AddRuleConditions",
    "value": {
      "conditions": [
        {
          "id": "0.646952",
          "property": "keyId",
          "op": "IsFalse",
          "value": "IsFalse"
        }
      ],
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
      ],
      "ruleId": "df830874-2fc2-4809-a419-f5dae9112281"
    }
  },
  {
    "kind": "RemoveTargetUsers",
    "value": {
      "keyIds": [
        "user3"
      ],
      "variationId": "e834669c-9f1f-4890-b014-9e86226cdbc8"
    }
  },
  {
    "kind": "AddTargetUsers",
    "value": {
      "keyIds": [
        "user5"
      ],
      "variationId": "e834669c-9f1f-4890-b014-9e86226cdbc8"
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
