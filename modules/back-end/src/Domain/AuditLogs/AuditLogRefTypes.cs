namespace Domain.AuditLogs;

public class AuditLogRefTypes
{
    public const string FeatureFlag = nameof(FeatureFlag);

    public const string Segment = nameof(Segment);

    public const string Member = nameof(Member);

    public const string Group = nameof(Group);

    public const string Policy = nameof(Policy);

    public static readonly string[] All = [FeatureFlag, Segment, Member, Group, Policy];

    public static bool IsDefined(string type) => All.Contains(type);
}
