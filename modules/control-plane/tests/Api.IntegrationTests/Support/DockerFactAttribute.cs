namespace Api.IntegrationTests.Support;

/// <summary>
/// A <see cref="FactAttribute"/> that skips when no local Docker daemon is reachable.
/// Use on every integration test that depends on Testcontainers.
/// </summary>
public sealed class DockerFactAttribute : FactAttribute
{
    public DockerFactAttribute()
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
    public DockerTheoryAttribute()
    {
        if (!DockerAvailability.IsAvailable)
        {
            Skip = DockerAvailability.SkipReason;
        }
    }
}
