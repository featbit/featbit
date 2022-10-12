namespace Domain.FeatureFlags;

public class VariationTypes
{
    public const string Boolean = "boolean";

    public const string Json = "json";

    public const string Number = "number";

    public const string String = "string";

    public static readonly string[] All = { Boolean, Json, Number, String };

    public static bool IsDefined(string variationType)
    {
        return All.Contains(variationType);
    }
}