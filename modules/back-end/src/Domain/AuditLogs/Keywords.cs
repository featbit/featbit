using Domain.FeatureFlags;
using Domain.Segments;

namespace Domain.AuditLogs;

public static class Keywords
{
    public static string For(FeatureFlag flag) => For(flag.Key, flag.Name);

    public static string For(Segment segment) => For(segment.Name);

    private static string For(params string[] keywords) => string.Join(',', keywords);
}