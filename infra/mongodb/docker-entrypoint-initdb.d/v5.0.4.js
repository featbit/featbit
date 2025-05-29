// https://github.com/featbit/featbit/pull/754
db.Policies.updateOne(
    {
        _id: UUID("3e961f0f-6fd4-4cf4-910f-52d356f8cc08"),
        "statements.resourceType": { $ne: "workspace" }
    },
    {
        $push: {
            statements: {
                _id: "7a910fbd-9463-4563-af72-fa977d34fdb2",
                resourceType: "workspace",
                effect: "allow",
                actions: [
                    "UpdateWorkspaceGeneralSettings",
                    "UpdateWorkspaceLicense",
                    "UpdateWorkspaceSSOSettings"
                ],
                resources: ["workspace/*"]
            }
        }
    }
);