using Domain.FeatureFlags;

namespace Domain.AuditLogs;

public static class Keywords
{
    public static string For(FeatureFlag flag) => For(flag.Key, flag.Name);

    private static string For(params string[] keywords) => string.Join(',', keywords);
}