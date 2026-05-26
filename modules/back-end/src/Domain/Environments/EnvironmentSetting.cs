namespace Domain.Environments;

public class EnvironmentSetting
{
    /// <summary>
    /// Whether to require users to provide a comment when changing a flag value in the environment.
    /// This is used for audit and change tracking purposes.
    /// </summary>
    public bool RequireChangeComment { get; set; }
}