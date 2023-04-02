using Microsoft.AspNetCore.JsonPatch.Operations;
using Swashbuckle.AspNetCore.Filters;

namespace Api.Swagger.Examples;

public class PatchFeatureFlagExamples : IMultipleExamplesProvider<List<Operation>>
{
    public IEnumerable<SwaggerExample<List<Operation>>> GetExamples()
    {
        yield return SwaggerExample.Create(
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

        yield return SwaggerExample.Create(
            "Archive the flag",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "isArchived",
                    value = true
                }
            }
        );

        yield return SwaggerExample.Create(
            "Restore the flag",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "isArchived",
                    value = false
                }
            }
        );

        yield return SwaggerExample.Create(
            "Enable the flag",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "isEnabled",
                    value = true
                }
            }
        );

        yield return SwaggerExample.Create(
            "Disable the flag",
            new List<Operation>
            {
                new()
                {
                    op = "replace",
                    path = "isEnabled",
                    value = false
                }
            }
        );

        yield return SwaggerExample.Create(
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

        yield return SwaggerExample.Create(
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

        yield return SwaggerExample.Create(
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

        yield return SwaggerExample.Create(
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
    }
}