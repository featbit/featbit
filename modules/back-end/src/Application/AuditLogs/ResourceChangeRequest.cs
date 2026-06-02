namespace Application.AuditLogs;

/// <summary>
/// Optional payload carrying a user-supplied comment for operations that do not have a dedicated request body.
/// This allows users to provide context for their actions, which can be valuable for auditing and understanding the
/// history of changes.
/// </summary>
public class ResourceChangeRequest
{
    /// <summary>
    /// Optional comment describing why the change was made.
    /// </summary>
    public string Comment { get; set; } = string.Empty;
}