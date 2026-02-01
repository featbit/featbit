using Microsoft.AspNetCore.JsonPatch.Operations;
using Swashbuckle.AspNetCore.Filters;

namespace Api.Swagger.Examples;

public class PatchSegmentExamples : IMultipleExamplesProvider<List<Operation>>
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

        yield return SwaggerExample.Create(
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

        yield return SwaggerExample.Create(
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
        
        yield return SwaggerExample.Create(
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

        yield return SwaggerExample.Create(
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

        yield return SwaggerExample.Create(
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