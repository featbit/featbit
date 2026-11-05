namespace Application.AuditLogs;

public static class AuditLogScopes
{
    public const string Environment = nameof(Environment);
    public const string Organization = nameof(Organization);
    public const string Workspace = nameof(Workspace);

    public static readonly string[] All = [Environment, Organization, Workspace];

    public static bool IsDefined(string scope) => All.Contains(scope);
}
