namespace Domain.Environments;

public record EnvironmentSettings
{
    /// <summary>
    /// Whether to require users to provide a comment when changing a flag value in the environment.
    /// This is used for audit and change tracking purposes.
    /// </summary>
    public bool RequireChangeComment { get; set; }

    // for ef core and System.Text.Json, also define the default environment settings
    public EnvironmentSettings()
    {
        RequireChangeComment = false;
    }
}