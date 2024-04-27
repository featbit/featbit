using Domain.Resources;

namespace Api.Authorization;

public static class Permissions
{
    public const string ReadFeatureFlag = nameof(ReadFeatureFlag);
    public const string WriteFeatureFlag = nameof(WriteFeatureFlag);
    public const string ReadSegment = nameof(ReadSegment);
    public const string WriteSegment = nameof(WriteSegment);

    public static readonly Dictionary<string, string> ResourceMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { ReadFeatureFlag, ResourceTypes.FeatureFlag },
        { WriteFeatureFlag, ResourceTypes.FeatureFlag },
        { ReadSegment, ResourceTypes.FeatureFlag },
        { WriteSegment, ResourceTypes.FeatureFlag }
    };

    public static readonly string[] All = ResourceMap.Keys.ToArray();

    public static bool IsDefined(string permission)
    {
        return ResourceMap.ContainsKey(permission);
    }
}