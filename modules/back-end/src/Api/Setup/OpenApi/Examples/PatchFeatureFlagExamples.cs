using Microsoft.AspNetCore.JsonPatch.SystemTextJson.Operations;

namespace Api.Setup.OpenApi.Examples;

public class PatchFeatureFlagExamples : IOpenApiExamplesProvider
{
    public IEnumerable<(string Name, object Value)> GetExamples()
    {
        yield return (
            "Update name and description",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "/name",
                    value = "new name",
                },
                new()
                {
                    op = "replace",
                    path = "/description",
                    value = "new description"
                }
            }
        );

        yield return (
            "Archive the flag",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "/isArchived",
                    value = true
                }
            }
        );

        yield return (
            "Restore the flag",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "/isArchived",
                    value = false
                }
            }
        );

        yield return (
            "Enable the flag",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "/isEnabled",
                    value = true
                }
            }
        );

        yield return (
            "Disable the flag",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "/isEnabled",
                    value = false
                }
            }
        );

        yield return (
            "Add target user when the targeting variation has no users",
            new List<Operation>
            {
                new()
                {
                    op = "add",
                    path = "/targetUsers/-",
                    value = new
                    {
                        variationId = "51dfeca4-c1b0-4aa4-aff1-851ddb1c180d",
                        keyIds = new[] { "user1", "user2" }
                    }
                }
            }
        );

        yield return (
            "Add target user to the first targeting variation",
            new List<Operation>
            {
                new()
                {
                    op = "add",
                    path = "/targetUsers/0/keyIds/0",
                    value = "new-user"
                }
            }
        );

        yield return (
            "Add rule",
            new List<Operation>
            {
                new()
                {
                    op = "add",
                    path = "/rules/-",
                    value = new
                    {
                        id = "f5a5629e-523d-459e-b0b0-f4996e32842a",
                        name = "Rule 2",
                        dispatchKey = "name",
                        includedInExpt = false,
                        conditions = new[]
                        {
                            new
                            {
                                property = "keyId",
                                op = "IsOneOf",
                                value = "[\"ja\",\"jb\",\"jc\"]"
                            }
                        },
                        variations = new[]
                        {
                            new
                            {
                                id = "51dfeca4-c1b0-4aa4-aff1-851ddb1c180d",
                                rollout = new[]
                                {
                                    0,
                                    0.64
                                },
                                exptRollout = 1
                            },
                            new
                            {
                                id = "990c319a-a21d-418b-a900-4fd4713ade29",
                                rollout = new[]
                                {
                                    0.64,
                                    1
                                },
                                exptRollout = 1
                            }
                        }
                    }
                }
            }
        );

        yield return (
            "Remove the first rule",
            new List<Operation>
            {
                new()
                {
                    op = "remove",
                    path = "/rules/0"
                }
            }
        );

        yield return (
            "Add a new variation", new List<Operation>
            {
                new()
                {
                    op = "add",
                    path = "/variations/-",
                    value = new
                    {
                        id = "2848dccc-9659-4d43-bd86-2ed599efe595",
                        name = "New variation",
                        value = "new value"
                    }
                }
            }
        );

        yield return (
            "Update the first variation value",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "/variations/0/value",
                    value = "new variation value"
                }
            }
        );
    }
}
