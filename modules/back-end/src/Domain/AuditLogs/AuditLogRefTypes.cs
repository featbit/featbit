namespace Domain.AuditLogs;

public class AuditLogRefTypes
{
    public const string FeatureFlag = nameof(FeatureFlag);

    public static readonly string[] All = { FeatureFlag };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}