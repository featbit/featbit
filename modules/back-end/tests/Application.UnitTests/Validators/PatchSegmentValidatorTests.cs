using Application.Bases;
using Application.Segments;
using Domain.Segments;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson.Operations;

namespace Application.UnitTests.Validators;

public class PatchSegmentValidatorTests
{
    public static TheoryData<string, string> ProtectedPaths()
    {
        var cases = new TheoryData<string, string>();
        string[] paths =
        [
            "/id", "/workspaceId", "/envId", "/key", "/type", "/scopes", "/scopes/0",
            "/createdAt", "/updatedAt", "/committedVersion", "/pending", "/pending/value/name",
            "/xmin", "/isEnvironmentSpecific", "/ENVId",
            "", "/", "/name~1envId", "/unknown"
        ];
        foreach (var path in paths)
        {
            cases.Add("replace", path);
        }

        // Other operation types must enforce the same destination whitelist.
        foreach (var op in new[] { "add", "remove", "move", "copy", "test" })
        {
            cases.Add(op, "/key");
        }

        return cases;
    }

    [Theory]
    [MemberData(nameof(ProtectedPaths))]
    public void Validate_ProtectedPath_RejectsEntireDocument(string op, string path)
    {
        var patch = new JsonPatchDocument<Segment>();
        patch.Replace(x => x.Description, "must not be applied");
        patch.Operations.Add(new Operation<Segment>(op, path, "/name", "forged"));

        AssertInvalid(patch, "path", 1);
    }

    [Fact]
    public void Validate_MoveFromProtectedField_ReturnsSourceError()
    {
        var patch = new JsonPatchDocument<Segment>();
        patch.Operations.Add(new Operation<Segment>("move", "/name", "/key", null));

        AssertInvalid(patch, "from", 0);
    }

    [Fact]
    public void Validate_NullDocument_ReturnsRequiredError()
    {
        var result = new PatchSegmentValidator().Validate(new PatchSegment { Patch = null! });

        var error = Assert.Single(result.Errors);
        Assert.Equal(ErrorCodes.Required("patch"), error.ErrorCode);
    }

    [Theory]
    [InlineData("replace", "/description", null)]
    [InlineData("add", "/rules/-", null)]
    [InlineData("remove", "/included/0", null)]
    [InlineData("replace", "/Name", null)]
    [InlineData("move", "/tags/0", "/tags/1")]
    [InlineData("copy", "/description", "/key")]
    [InlineData("test", "/description", null)]
    public void Validate_AllowedOperation_Succeeds(string op, string path, string? from)
    {
        var patch = new JsonPatchDocument<Segment>();
        patch.Operations.Add(new Operation<Segment>(op, path, from, null));

        var result = new PatchSegmentValidator().Validate(new PatchSegment { Patch = patch });

        Assert.True(result.IsValid);
    }

    private static void AssertInvalid(JsonPatchDocument<Segment> patch, string property, int operationIndex)
    {
        var result = new PatchSegmentValidator().Validate(new PatchSegment { Patch = patch });

        var error = Assert.Single(result.Errors);
        Assert.Equal(ErrorCodes.Invalid(property), error.ErrorCode);
        Assert.Equal($"Patch.Operations[{operationIndex}].{property}", error.PropertyName);
    }
}
