using System.Runtime.CompilerServices;

namespace Api.IntegrationTests.Support;

/// <summary>
/// A <see cref="FactAttribute"/> that skips when no local Docker daemon is reachable.
/// Use on every integration test that depends on Testcontainers.
/// </summary>
public sealed class DockerFactAttribute : FactAttribute
{
    // The caller's file and line let test runners link results to the test (xUnit3003).
    public DockerFactAttribute([CallerFilePath] string? sourceFilePath = null, [CallerLineNumber] int sourceLineNumber = -1)
        : base(sourceFilePath, sourceLineNumber)
    {
        if (!DockerAvailability.IsAvailable)
        {
            Skip = DockerAvailability.SkipReason;
        }
    }
}

/// <summary>
/// A <see cref="TheoryAttribute"/> that skips when no local Docker daemon is reachable.
/// </summary>
public sealed class DockerTheoryAttribute : TheoryAttribute
{
    // The caller's file and line let test runners link results to the test (xUnit3003).
    public DockerTheoryAttribute([CallerFilePath] string? sourceFilePath = null, [CallerLineNumber] int sourceLineNumber = -1)
        : base(sourceFilePath, sourceLineNumber)
    {
        if (!DockerAvailability.IsAvailable)
        {
            Skip = DockerAvailability.SkipReason;
        }
    }
}
