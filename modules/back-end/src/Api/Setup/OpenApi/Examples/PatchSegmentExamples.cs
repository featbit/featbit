using Microsoft.AspNetCore.JsonPatch.SystemTextJson.Operations;

namespace Api.Setup.OpenApi.Examples;

public class PatchSegmentExamples : IOpenApiExamplesProvider
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
            "Archive the segment",
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
            "Restore the segment",
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
            "Add one targeting user to included users",
            new List<Operation>
            {
                new()
                {
                    op = "add",
                    path = "/included/-",
                    value = "user1"
                }
            }
        );

        yield return (
            "Add one targeting user to excluded users",
            new List<Operation>
            {
                new()
                {
                    op = "add",
                    path = "/excluded/-",
                    value = "user1"
                }
            }
        );

        yield return (
            "Overwrite included users",
            new List<Operation>
            {
                new()
                {
                    op = "add",
                    path = "/included",
                    value = new[] { "user1", "user2" }
                }
            }
        );

        yield return (
            "Overwrite excluded users",
            new List<Operation>
            {
                new()
                {
                    op = "add",
                    path = "/excluded",
                    value = new[] { "user1", "user2" }
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
                        name = "Rule 1",
                        conditions = new[]
                        {
                            new
                            {
                                property = "keyId",
                                op = "IsOneOf",
                                value = "[\"ja\",\"jb\",\"jc\"]"
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
    }
}
