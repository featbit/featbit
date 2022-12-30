namespace Domain.AuditLogs;

public class AuditLogRefTypes
{
    public const string FeatureFlag = nameof(FeatureFlag);

    public const string Segment = nameof(Segment);

    public static readonly string[] All = { FeatureFlag, Segment };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}