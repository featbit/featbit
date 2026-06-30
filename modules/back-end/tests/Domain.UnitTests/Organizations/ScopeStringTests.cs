using Domain.Organizations;

namespace Domain.UnitTests.Organizations;

public class ScopeStringTests
{
    [Fact]
    public void Ctor_ValidProjectAndEnvIds_ParsesBothSides()
    {
        var projectId = Guid.NewGuid();
        var envA = Guid.NewGuid();
        var envB = Guid.NewGuid();

        var scope = new ScopeString($"{projectId}/{envA},{envB}");

        Assert.Equal(projectId, scope.ProjectId);
        Assert.Equal(new[] { envA, envB }, scope.EnvIds);
    }

    [Fact]
    public void Ctor_MalformedInputMissingSlash_ReturnsEmptyDefaults()
    {
        var scope = new ScopeString("no-slash-here");

        Assert.Equal(Guid.Empty, scope.ProjectId);
        Assert.Empty(scope.EnvIds);
    }

    [Fact]
    public void Ctor_MalformedInputTooManySlashes_ReturnsEmptyDefaults()
    {
        var scope = new ScopeString("a/b/c");

        Assert.Equal(Guid.Empty, scope.ProjectId);
        Assert.Empty(scope.EnvIds);
    }
}
