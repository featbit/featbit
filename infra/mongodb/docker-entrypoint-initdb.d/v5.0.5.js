const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/759

const administratorPolicyId = UUID("3e961f0f-6fd4-4cf4-910f-52d356f8cc08")

function getUUIDString() {
    return UUID().toString().split('"')[1];
}

const newStatement = {
  _id: getUUIDString(),
  resourceType: "organization",
  effect: "allow",
  actions: [
    "UpdateOrgName",
    "UpdateOrgDefaultUserPermissions",
    "CreateOrg"
  ],
  resources: ["organization/*"]
};

// Step 1: Pull any existing organization statement
db.Policies.updateOne(
  { _id: administratorPolicyId },
  { $pull: { statements: { resourceType: "organization" } } }
);

// Step 2: Push the new statement
db.Policies.updateOne(
  { _id: administratorPolicyId },
  { $push: { statements: newStatement } }
);