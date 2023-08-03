namespace Domain.SemanticPatch;

public class SemanticPatchType
{
    public const string FeatureFlag = nameof(FeatureFlag);

    public static readonly string[] All = { FeatureFlag };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}