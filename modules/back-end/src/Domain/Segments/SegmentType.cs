namespace Domain.Segments;

public static class SegmentType
{
    public const string EnvironmentSpecific = "environment-specific";
    public const string Shared = "shared";

    public static bool IsDefined(string type)
    {
        return type is EnvironmentSpecific or Shared;
    }
}