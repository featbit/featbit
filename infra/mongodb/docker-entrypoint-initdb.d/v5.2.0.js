const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/802

db.Segments.updateMany(
    { tags: { $exists: false } },
    { $set: { tags: [] } }
);

// https://github.com/featbit/featbit/pull/811

db.Organizations.updateMany(
    {},
    {
        $set: {
            "settings.flagSortedBy": "created_at"
        }
    }
);

db.Policies.updateOne(
    {
        type: "SysManaged",
        name: "Administrator"
    },
    {
        $push: {
            "statements.$[org].actions": {
                $each: ["UpdateOrgSortFlagsBy"],
                $position: 0
            }
        }
    },
    {
        arrayFilters: [
            { "org.resourceType": "organization" }
        ]
    }
);

// https://github.com/featbit/featbit/pull/821

db.Policies.updateMany(
    {
        "statements.resourceType": "flag",
        "statements.actions": "ManageFeatureFlag"
    },
    {
        $set: {
            "statements.$[stmt].actions": ["*"]
        }
    },
    {
        arrayFilters: [
            {
                "stmt.resourceType": "flag",
                "stmt.actions": "ManageFeatureFlag"
            }
        ]
    }
)

db.AccessTokens.updateMany(
    {
        "permissions.resourceType": "flag",
        "permissions.actions": "ManageFeatureFlag"
    },
    {
        $set: {
            "permissions.$[perm].actions": ["*"]
        }
    },
    {
        arrayFilters: [
            {
                "perm.resourceType": "flag",
                "perm.actions": "ManageFeatureFlag"
            }
        ]
    }
);

// update built-in 'Administrator' and 'Developer' policies to ensure they have full access to feature flags
db.Policies.updateMany(
  {
    organizationId: null,
    type: "SysManaged",
    name: { $in: ["Administrator", "Developer"] }
  },
  [
    {
      $set: {
        statements: {
          $cond: [
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: ["$statements", []] },
                      as: "s",
                      cond: {
                        $and: [
                          { $eq: ["$$s.resourceType", "flag"] },
                          { $eq: ["$$s.effect", "allow"] },
                          { $eq: ["$$s.actions", ["*"]] },
                          {
                            $eq: [
                              "$$s.resources",
                              ["project/*:env/*:flag/*"]
                            ]
                          }
                        ]
                      }
                    }
                  }
                },
                0
              ]
            },
            "$statements",
            {
              $concatArrays: [
                { $ifNull: ["$statements", []] },
                [
                  {
                    _id: {
                      $function: {
                        body: function () {
                          return UUID().toString().split('"')[1];
                        },
                        args: [],
                        lang: "js"
                      }
                    },
                    resourceType: "flag",
                    effect: "allow",
                    actions: ["*"],
                    resources: ["project/*:env/*:flag/*"]
                  }
                ]
              ]
            }
          ]
        }
      }
    }
  ]
);

